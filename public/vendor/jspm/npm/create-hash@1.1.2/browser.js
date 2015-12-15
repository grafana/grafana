/* */ 
(function(Buffer) {
  'use strict';
  var inherits = require('inherits');
  var md5 = require('./md5');
  var rmd160 = require('ripemd160');
  var sha = require('sha.js');
  var Base = require('cipher-base');
  function HashNoConstructor(hash) {
    Base.call(this, 'digest');
    this._hash = hash;
    this.buffers = [];
  }
  inherits(HashNoConstructor, Base);
  HashNoConstructor.prototype._update = function(data) {
    this.buffers.push(data);
  };
  HashNoConstructor.prototype._final = function() {
    var buf = Buffer.concat(this.buffers);
    var r = this._hash(buf);
    this.buffers = null;
    return r;
  };
  function Hash(hash) {
    Base.call(this, 'digest');
    this._hash = hash;
  }
  inherits(Hash, Base);
  Hash.prototype._update = function(data) {
    this._hash.update(data);
  };
  Hash.prototype._final = function() {
    return this._hash.digest();
  };
  module.exports = function createHash(alg) {
    alg = alg.toLowerCase();
    if ('md5' === alg)
      return new HashNoConstructor(md5);
    if ('rmd160' === alg || 'ripemd160' === alg)
      return new HashNoConstructor(rmd160);
    return new Hash(sha(alg));
  };
})(require('buffer').Buffer);
