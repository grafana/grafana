/* */ 
(function(Buffer) {
  var _algos = require('./algos');
  var createHash = require('create-hash');
  var inherits = require('inherits');
  var sign = require('./sign');
  var stream = require('stream');
  var verify = require('./verify');
  var algos = {};
  Object.keys(_algos).forEach(function(key) {
    algos[key] = algos[key.toLowerCase()] = _algos[key];
  });
  function Sign(algorithm) {
    stream.Writable.call(this);
    var data = algos[algorithm];
    if (!data) {
      throw new Error('Unknown message digest');
    }
    this._hashType = data.hash;
    this._hash = createHash(data.hash);
    this._tag = data.id;
    this._signType = data.sign;
  }
  inherits(Sign, stream.Writable);
  Sign.prototype._write = function _write(data, _, done) {
    this._hash.update(data);
    done();
  };
  Sign.prototype.update = function update(data, enc) {
    if (typeof data === 'string') {
      data = new Buffer(data, enc);
    }
    this._hash.update(data);
    return this;
  };
  Sign.prototype.sign = function signMethod(key, enc) {
    this.end();
    var hash = this._hash.digest();
    var sig = sign(Buffer.concat([this._tag, hash]), key, this._hashType, this._signType);
    return enc ? sig.toString(enc) : sig;
  };
  function Verify(algorithm) {
    stream.Writable.call(this);
    var data = algos[algorithm];
    if (!data) {
      throw new Error('Unknown message digest');
    }
    this._hash = createHash(data.hash);
    this._tag = data.id;
    this._signType = data.sign;
  }
  inherits(Verify, stream.Writable);
  Verify.prototype._write = function _write(data, _, done) {
    this._hash.update(data);
    done();
  };
  Verify.prototype.update = function update(data, enc) {
    if (typeof data === 'string') {
      data = new Buffer(data, enc);
    }
    this._hash.update(data);
    return this;
  };
  Verify.prototype.verify = function verifyMethod(key, sig, enc) {
    if (typeof sig === 'string') {
      sig = new Buffer(sig, enc);
    }
    this.end();
    var hash = this._hash.digest();
    return verify(sig, Buffer.concat([this._tag, hash]), key, this._signType);
  };
  function createSign(algorithm) {
    return new Sign(algorithm);
  }
  function createVerify(algorithm) {
    return new Verify(algorithm);
  }
  module.exports = {
    Sign: createSign,
    Verify: createVerify,
    createSign: createSign,
    createVerify: createVerify
  };
})(require('buffer').Buffer);
