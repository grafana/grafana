/* */ 
(function(Buffer) {
  var aes = require('./aes');
  var Transform = require('cipher-base');
  var inherits = require('inherits');
  var modes = require('./modes');
  var StreamCipher = require('./streamCipher');
  var AuthCipher = require('./authCipher');
  var ebtk = require('evp_bytestokey');
  inherits(Decipher, Transform);
  function Decipher(mode, key, iv) {
    if (!(this instanceof Decipher)) {
      return new Decipher(mode, key, iv);
    }
    Transform.call(this);
    this._cache = new Splitter();
    this._last = void 0;
    this._cipher = new aes.AES(key);
    this._prev = new Buffer(iv.length);
    iv.copy(this._prev);
    this._mode = mode;
    this._autopadding = true;
  }
  Decipher.prototype._update = function(data) {
    this._cache.add(data);
    var chunk;
    var thing;
    var out = [];
    while ((chunk = this._cache.get(this._autopadding))) {
      thing = this._mode.decrypt(this, chunk);
      out.push(thing);
    }
    return Buffer.concat(out);
  };
  Decipher.prototype._final = function() {
    var chunk = this._cache.flush();
    if (this._autopadding) {
      return unpad(this._mode.decrypt(this, chunk));
    } else if (chunk) {
      throw new Error('data not multiple of block length');
    }
  };
  Decipher.prototype.setAutoPadding = function(setTo) {
    this._autopadding = !!setTo;
  };
  function Splitter() {
    if (!(this instanceof Splitter)) {
      return new Splitter();
    }
    this.cache = new Buffer('');
  }
  Splitter.prototype.add = function(data) {
    this.cache = Buffer.concat([this.cache, data]);
  };
  Splitter.prototype.get = function(autoPadding) {
    var out;
    if (autoPadding) {
      if (this.cache.length > 16) {
        out = this.cache.slice(0, 16);
        this.cache = this.cache.slice(16);
        return out;
      }
    } else {
      if (this.cache.length >= 16) {
        out = this.cache.slice(0, 16);
        this.cache = this.cache.slice(16);
        return out;
      }
    }
    return null;
  };
  Splitter.prototype.flush = function() {
    if (this.cache.length) {
      return this.cache;
    }
  };
  function unpad(last) {
    var padded = last[15];
    var i = -1;
    while (++i < padded) {
      if (last[(i + (16 - padded))] !== padded) {
        throw new Error('unable to decrypt data');
      }
    }
    if (padded === 16) {
      return;
    }
    return last.slice(0, 16 - padded);
  }
  var modelist = {
    ECB: require('./modes/ecb'),
    CBC: require('./modes/cbc'),
    CFB: require('./modes/cfb'),
    CFB8: require('./modes/cfb8'),
    CFB1: require('./modes/cfb1'),
    OFB: require('./modes/ofb'),
    CTR: require('./modes/ctr'),
    GCM: require('./modes/ctr')
  };
  function createDecipheriv(suite, password, iv) {
    var config = modes[suite.toLowerCase()];
    if (!config) {
      throw new TypeError('invalid suite type');
    }
    if (typeof iv === 'string') {
      iv = new Buffer(iv);
    }
    if (typeof password === 'string') {
      password = new Buffer(password);
    }
    if (password.length !== config.key / 8) {
      throw new TypeError('invalid key length ' + password.length);
    }
    if (iv.length !== config.iv) {
      throw new TypeError('invalid iv length ' + iv.length);
    }
    if (config.type === 'stream') {
      return new StreamCipher(modelist[config.mode], password, iv, true);
    } else if (config.type === 'auth') {
      return new AuthCipher(modelist[config.mode], password, iv, true);
    }
    return new Decipher(modelist[config.mode], password, iv);
  }
  function createDecipher(suite, password) {
    var config = modes[suite.toLowerCase()];
    if (!config) {
      throw new TypeError('invalid suite type');
    }
    var keys = ebtk(password, false, config.key, config.iv);
    return createDecipheriv(suite, keys.key, keys.iv);
  }
  exports.createDecipher = createDecipher;
  exports.createDecipheriv = createDecipheriv;
})(require('buffer').Buffer);
