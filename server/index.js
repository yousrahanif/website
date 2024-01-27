const express = require('express');
const app = express();
const cors = require('cors');

const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()
const stripe= require('stripe')(process.env.PAYMENT_SECRET_KEY)
app.use(cors())
app.use(express.json())

const verifyJWT =(req,res,next)=>{
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({error: true, message:'unauthorized access'})
  }
  //barear token
  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err,decoded)=>{
    if(err){
      return res.status(401).send({error: true, message:'unauthorized access'})
      

    }
    req.decoded =decoded;
    next();
  })


} 





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sdwsth3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

const menuCollection = client.db('restaurantDB').collection("menu")
const reviewCollection = client.db('restaurantDB').collection("reviews")
const cartCollection = client.db('restaurantDB').collection("carts")
const usersCollection = client.db('restaurantDB').collection("users")
const paymentCollection = client.db('restaurantDB').collection("payments")

app.post('/jwt', (req,res)=>{
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
  res.send(token)

})





const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email }
  const user = await usersCollection.findOne(query);
  if (user?.role !== 'admin') {
    return res.status(403).send({ error: true, message: 'forbidden message' });
  }
  next();
}




//user relted apis

app.post('/users', async(req,res)=>{
  const user = req.body;
 
  const query = {email: user.email}
  const existingUser = await usersCollection.findOne(query);
  if(existingUser){
    return res.send({message: 'User already exist'})
  }
  const result = await usersCollection.insertOne(user)
  res.send(result)

})

app.get('/users', verifyJWT, verifyAdmin, async(req,res)=>{
  const result = await usersCollection.find().toArray()
  res.send(result)
})


app.patch('/users/admin/:id', async(req,res)=>{
  const id = req.params.id;
  console.log(id)
  const filter ={_id: new ObjectId(id)}
  const updateDoc = {
    $set: {
      role: 'admin'
    },
  };
  const result = await usersCollection.updateOne(filter,updateDoc)
  res.send(result)
})

app.get('/users/admin/:email',  verifyJWT, async(req,res)=>{
  const email = req.params.email;
  if(req.decoded.email!==email){
    res.send({admin:false})
  }
  const query={email: email}
  const user =await usersCollection.findOne(query)
  const result ={admin: user?.role==='admin'}
  res.send(result)
})
//About menu
app.get('/menu', async(req,res)=>{
    const result = await menuCollection.find().toArray();
    res.send(result)

})

app.post('/menu', verifyJWT, verifyAdmin, async(req,res)=>{
  const newItem=req.body;
  const result=await menuCollection.insertOne(newItem)
  res.send(result)
})





///////

app.put('/menu/:id', verifyJWT, verifyAdmin, async(req,res)=>{
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)}
  const options = { upsert: true };
  const updatedMenu = req.body;
  const menu = {
    $set: {
      name: updatedMenu.name || '',
      price: updatedMenu.price || 0,
      category: updatedMenu.category || '',
      recipe: updatedMenu.recipe || '',
      image: updatedMenu.image || '',

    }
  }
  const result=await menuCollection.updateOne(filter, menu, options)
  res.send(result)
})















app.delete('/menu/:id',verifyJWT, verifyAdmin, async(req,res)=>{
  const id =req.params.id;
  const query = {_id: new ObjectId(id)}
  const result= await menuCollection.deleteOne(query)
  res.send(result)
})

//review releted api 
app.get('/reviews', async(req,res)=>{
    const result = await reviewCollection.find().toArray();
    res.send(result)

})


app.get('/carts', verifyJWT, async(req,res)=>{
  const email =req.query.email;
  if(!email){
    res.send([])
  }
  //not to get others data

  const decodedEmail = req.decoded.email;
  if(email!==decodedEmail){
    return res.status(403).send({error: true, message:'forbidden access'})
  }
  
    const query ={email:email}
    const result = await cartCollection.find(query).toArray()
    res.send(result);
 

})

//Shopping cart
app.post('/carts', async(req,res)=>{
  const item = req.body;
  console.log(item)
  const result = await cartCollection.insertOne(item)
  res.send(result)
})

app.delete('/carts/:id', async(req,res)=>{
const id = req.params.id;
const query = {_id: new ObjectId(id)}
const result =await cartCollection.deleteOne(query)

res.send(result)

})


//Create Payment Intent

app.post('/create-payment-intent', verifyJWT,async(req,res)=>{
  const {price} = req.body;
  //strip takes in cents
  const amount =parseInt(price*100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount, 
    currency: 'usd', 
    payment_method_types: ['card']
  })
  res.send({
    clientSecret: paymentIntent.client_secret
  })

})

app.post('/payments', verifyJWT, async(req,res)=>{
  const payment= req.body;
  const insertResult = await paymentCollection.insertOne(payment)


const query = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}}
const deleteResult = await cartCollection.deleteMany(query)


  res.send({insertResult,deleteResult})
})

app.get('/admin-data',verifyJWT, verifyAdmin, async(req,res)=>{
  const users = await usersCollection.estimatedDocumentCount()
  const products = await menuCollection.estimatedDocumentCount();
  const orders = await paymentCollection.estimatedDocumentCount()

  const payments  =await paymentCollection.find().toArray()
  const revenue = payments.reduce((sum,payment)=>sum+payment.price,0) 
  res.send({
    users, 
    products, 
    orders, 
    revenue
  })
})

// app.get('/order-data', async(req,res)=>{
//   //const pipeline = 

// })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/',(req,res)=>{
    res.send('Delightful Hub')
})

app.listen(port, ()=>{
    console.log(`Delightful hun is on port ${port}`)
})