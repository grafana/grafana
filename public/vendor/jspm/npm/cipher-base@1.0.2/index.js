/* */ 
(function(Buffer) {
  var Transform = require('stream').Transform;
  var inherits = require('inherits');
  var StringDecoder = require('string_decoder').StringDecoder;
  module.exports = CipherBase;
  inherits(CipherBase, Transform);
  function CipherBase(hashMode) {
    Transform.call(this);
    this.hashMode = typeof hashMode === 'string';
    if (this.hashMode) {
      this[hashMode] = this._finalOrDigest;
    } else {
      this.final = this._finalOrDigest;
    }
    this._decoder = null;
    this._encoding = null;
  }
  CipherBase.prototype.update = function(data, inputEnc, outputEnc) {
    if (typeof data === 'string') {
      data = new Buffer(data, inputEnc);
    }
    var outData = this._update(data);
    if (this.hashMode) {
      return this;
    }
    if (outputEnc) {
      outData = this._toString(outData, outputEnc);
    }
    return outData;
  };
  CipherBase.prototype.setAutoPadding = function() {};
  CipherBase.prototype.getAuthTag = function() {
    throw new Error('trying to get auth tag in unsupported state');
  };
  CipherBase.prototype.setAuthTag = function() {
    throw new Error('trying to set auth tag in unsupported state');
  };
  CipherBase.prototype.setAAD = function() {
    throw new Error('trying to set aad in unsupported state');
  };
  CipherBase.prototype._transform = function(data, _, next) {
    var err;
    try {
      if (this.hashMode) {
        this._update(data);
      } else {
        this.push(this._update(data));
      }
    } catch (e) {
      err = e;
    } finally {
      next(err);
    }
  };
  CipherBase.prototype._flush = function(done) {
    var err;
    try {
      this.push(this._final());
    } catch (e) {
      err = e;
    } finally {
      done(err);
    }
  };
  CipherBase.prototype._finalOrDigest = function(outputEnc) {
    var outData = this._final() || new Buffer('');
    if (outputEnc) {
      outData = this._toString(outData, outputEnc, true);
    }
    return outData;
  };
  CipherBase.prototype._toString = function(value, enc, final) {
    if (!this._decoder) {
      this._decoder = new StringDecoder(enc);
      this._encoding = enc;
    }
    if (this._encoding !== enc) {
      throw new Error('can\'t switch encodings');
    }
    var out = this._decoder.write(value);
    if (final) {
      out += this._decoder.end();
    }
    return out;
  };
})(require('buffer').Buffer);
