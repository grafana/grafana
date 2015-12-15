base64-js
=========

`base64-js` does basic base64 encoding/decoding in pure JS.

[![build status](https://secure.travis-ci.org/beatgammit/base64-js.png)](http://travis-ci.org/beatgammit/base64-js)

[![testling badge](https://ci.testling.com/beatgammit/base64-js.png)](https://ci.testling.com/beatgammit/base64-js)

Many browsers already have base64 encoding/decoding functionality, but it is for text data, not all-purpose binary data.

Sometimes encoding/decoding binary data in the browser is useful, and that is what this module does.

## install

With [npm](https://npmjs.org) do:

`npm install base64-js`

## methods

`var base64 = require('base64-js')`

`base64` has two exposed functions, `toByteArray` and `fromByteArray`, which both take a single argument.

* `toByteArray` - Takes a base64 string and returns a byte array
* `fromByteArray` - Takes a byte array and returns a base64 string

## license

MIT