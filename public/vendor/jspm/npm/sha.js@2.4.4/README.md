# sha.js

Streamable SHA hashes in pure javascript.

[![build status](https://secure.travis-ci.org/crypto-browserify/sha.js.png)](http://travis-ci.org/crypto-browserify/sha.js)
[![NPM](http://img.shields.io/npm/v/sha.js.svg)](https://www.npmjs.org/package/sha.js)


## Example

``` js
var createHash = require('sha.js')

var sha256 = createHash('sha256')
var sha512 = createHash('sha512')

var h = sha256.update('abc', 'utf8').digest('hex')
console.log(h) //ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad

//LEGACY, do not use in new systems:
var sha0 = createHash('sha')
var sha1 = createHash('sha1')


```

## supported hashes

sha.js currently implements:


* sha256
* sha512
* sha1 (legacy, no not use in new systems)
* sha (legacy, no not use in new systems)

## Note

Note, this doesn't actually implement a stream, but wrapping this in a stream is trivial.
but is does update incrementally, so you can hash things larger than ram, and also, since it reuses
the typedarrays, it uses a constant amount of memory (except when using base64 or utf8 encoding,
see code comments)


## Acknowledgements

This work is derived from Paul Johnston's ["A JavaScript implementation of the Secure Hash Algorithm"]
(http://pajhome.org.uk/crypt/md5/sha1.html)



## License

MIT
