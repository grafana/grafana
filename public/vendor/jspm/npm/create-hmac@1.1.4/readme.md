create-hmac
===

[![Build Status](https://travis-ci.org/crypto-browserify/createHmac.svg)](https://travis-ci.org/crypto-browserify/createHmac)

Node style hmacs for use in the browser, with native hmac functions in node. Api is the same as hmacs in node:

```js
var createHmac = require('create-hmac');
var hmac = createHmac('sha224', new Buffer("secret key"));
hmac.update('synchronous write'); //optional encoding parameter
hmac.digest();// synchronously get result with optional encoding parameter

hmac.write('write to it as a stream');
hmac.end();//remember it's a stream
hmac.read();//only if you ended it as a stream though
```

To get the JavaScript version even in node require `require('create-hmac/browser');`