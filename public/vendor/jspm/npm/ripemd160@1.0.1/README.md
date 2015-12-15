ripemd160
=========

JavaScript component to compute the RIPEMD-160 hash of strings or bytes. This hash is commonly used in crypto currencies
like Bitcoin.

Usage
-----

### Install

    npm install --save ripemd160


### ripemd160(input)

`input` should be either a `string`, `Buffer`, or an `Array`. It returns a `Buffer`. 

**example 1**:

```js
var ripemd16 = require('ripemd160')

var data = 'hello'
var result = ripemd160(data)
console.log(result.toString('hex'))
// => 108f07b8382412612c048d07d13f814118445acd
```

**example 2**:

```js
var ripemd16 = require('ripemd160')

var data = new Buffer('hello', 'utf8')
var result = ripemd160(data)
console.log(result.toString('hex'))
// => 108f07b8382412612c048d07d13f814118445acd
```


#### Converting Buffers

If you're not familiar with the Node.js ecosystem, type `Buffer` is a common way that a developer can pass around
binary data. `Buffer` also exists in the [Browserify](http://browserify.org/) environment. Converting to and from Buffers is very easy.

##### To buffer

```js
// from string
var buf = new Buffer('some string', 'utf8')

// from hex string
var buf = new Buffer('3f5a4c22', 'hex')

// from array
var buf = new Buffer([1, 2, 3, 4])
```

#### From buffer

```js
// to string
var str = buf.toString('utf8')

// to hex string
var hex = buf.toString('hex')

// to array
var arr = [].slice.call(buf)
```


Testing
-------

### Install dev deps:

    npm install --development

### Test in Node.js:

    npm run test

### Test in a Browser:

Testing in the browser uses the excellent [Mochify](https://github.com/mantoni/mochify.js). Mochify can use either PhantomJS 
or an actual browser. You must have Selenium installed if you want to use an actual browser. The easiest way is to 
`npm install -g start-selenium` and then run `start-selenium`.

Then run:

    npm run browser-test



License
-------

Licensed: BSD3-Clause
