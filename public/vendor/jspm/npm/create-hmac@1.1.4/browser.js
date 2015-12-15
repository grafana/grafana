/* */ 
(function(Buffer) {
  'use strict';
  var createHash = require('create-hash/browser');
  var inherits = require('inherits');
  var Transform = require('stream').Transform;
  var ZEROS = new Buffer(128);
  ZEROS.fill(0);
  function Hmac(alg, key) {
    Transform.call(this);
    alg = alg.toLowerCase();
    if (typeof key === 'string') {
      key = new Buffer(key);
    }
    var blocksize = (alg === 'sha512' || alg === 'sha384') ? 128 : 64;
    this._alg = alg;
    this._key = key;
    if (key.length > blocksize) {
      key = createHash(alg).update(key).digest();
    } else if (key.length < blocksize) {
      key = Buffer.concat([key, ZEROS], blocksize);
    }
    var ipad = this._ipad = new Buffer(blocksize);
    var opad = this._opad = new Buffer(blocksize);
    for (var i = 0; i < blocksize; i++) {
      ipad[i] = key[i] ^ 0x36;
      opad[i] = key[i] ^ 0x5C;
    }
    this._hash = createHash(alg).update(ipad);
  }
  inherits(Hmac, Transform);
  Hmac.prototype.update = function(data, enc) {
    this._hash.update(data, enc);
    return this;
  };
  Hmac.prototype._transform = function(data, _, next) {
    this._hash.update(data);
    next();
  };
  Hmac.prototype._flush = function(next) {
    this.push(this.digest());
    next();
  };
  Hmac.prototype.digest = function(enc) {
    var h = this._hash.digest();
    return createHash(this._alg).update(this._opad).update(h).digest(enc);
  };
  module.exports = function createHmac(alg, key) {
    return new Hmac(alg, key);
  };
})(require('buffer').Buffer);
