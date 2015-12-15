/* */ 
(function(Buffer) {
  var aes = require('./aes');
  var Transform = require('cipher-base');
  var inherits = require('inherits');
  var GHASH = require('./ghash');
  var xor = require('buffer-xor');
  inherits(StreamCipher, Transform);
  module.exports = StreamCipher;
  function StreamCipher(mode, key, iv, decrypt) {
    if (!(this instanceof StreamCipher)) {
      return new StreamCipher(mode, key, iv);
    }
    Transform.call(this);
    this._finID = Buffer.concat([iv, new Buffer([0, 0, 0, 1])]);
    iv = Buffer.concat([iv, new Buffer([0, 0, 0, 2])]);
    this._cipher = new aes.AES(key);
    this._prev = new Buffer(iv.length);
    this._cache = new Buffer('');
    this._secCache = new Buffer('');
    this._decrypt = decrypt;
    this._alen = 0;
    this._len = 0;
    iv.copy(this._prev);
    this._mode = mode;
    var h = new Buffer(4);
    h.fill(0);
    this._ghash = new GHASH(this._cipher.encryptBlock(h));
    this._authTag = null;
    this._called = false;
  }
  StreamCipher.prototype._update = function(chunk) {
    if (!this._called && this._alen) {
      var rump = 16 - (this._alen % 16);
      if (rump < 16) {
        rump = new Buffer(rump);
        rump.fill(0);
        this._ghash.update(rump);
      }
    }
    this._called = true;
    var out = this._mode.encrypt(this, chunk);
    if (this._decrypt) {
      this._ghash.update(chunk);
    } else {
      this._ghash.update(out);
    }
    this._len += chunk.length;
    return out;
  };
  StreamCipher.prototype._final = function() {
    if (this._decrypt && !this._authTag) {
      throw new Error('Unsupported state or unable to authenticate data');
    }
    var tag = xor(this._ghash.final(this._alen * 8, this._len * 8), this._cipher.encryptBlock(this._finID));
    if (this._decrypt) {
      if (xorTest(tag, this._authTag)) {
        throw new Error('Unsupported state or unable to authenticate data');
      }
    } else {
      this._authTag = tag;
    }
    this._cipher.scrub();
  };
  StreamCipher.prototype.getAuthTag = function getAuthTag() {
    if (!this._decrypt && Buffer.isBuffer(this._authTag)) {
      return this._authTag;
    } else {
      throw new Error('Attempting to get auth tag in unsupported state');
    }
  };
  StreamCipher.prototype.setAuthTag = function setAuthTag(tag) {
    if (this._decrypt) {
      this._authTag = tag;
    } else {
      throw new Error('Attempting to set auth tag in unsupported state');
    }
  };
  StreamCipher.prototype.setAAD = function setAAD(buf) {
    if (!this._called) {
      this._ghash.update(buf);
      this._alen += buf.length;
    } else {
      throw new Error('Attempting to set AAD in unsupported state');
    }
  };
  function xorTest(a, b) {
    var out = 0;
    if (a.length !== b.length) {
      out++;
    }
    var len = Math.min(a.length, b.length);
    var i = -1;
    while (++i < len) {
      out += (a[i] ^ b[i]);
    }
    return out;
  }
})(require('buffer').Buffer);
