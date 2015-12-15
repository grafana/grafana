/* */ 
(function(Buffer) {
  var aes = require('./aes');
  var Transform = require('cipher-base');
  var inherits = require('inherits');
  inherits(StreamCipher, Transform);
  module.exports = StreamCipher;
  function StreamCipher(mode, key, iv, decrypt) {
    if (!(this instanceof StreamCipher)) {
      return new StreamCipher(mode, key, iv);
    }
    Transform.call(this);
    this._cipher = new aes.AES(key);
    this._prev = new Buffer(iv.length);
    this._cache = new Buffer('');
    this._secCache = new Buffer('');
    this._decrypt = decrypt;
    iv.copy(this._prev);
    this._mode = mode;
  }
  StreamCipher.prototype._update = function(chunk) {
    return this._mode.encrypt(this, chunk, this._decrypt);
  };
  StreamCipher.prototype._final = function() {
    this._cipher.scrub();
  };
})(require('buffer').Buffer);
