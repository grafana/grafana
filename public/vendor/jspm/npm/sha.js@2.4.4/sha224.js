/* */ 
(function(Buffer) {
  var inherits = require('inherits');
  var Sha256 = require('./sha256');
  var Hash = require('./hash');
  var W = new Array(64);
  function Sha224() {
    this.init();
    this._w = W;
    Hash.call(this, 64, 56);
  }
  inherits(Sha224, Sha256);
  Sha224.prototype.init = function() {
    this._a = 0xc1059ed8 | 0;
    this._b = 0x367cd507 | 0;
    this._c = 0x3070dd17 | 0;
    this._d = 0xf70e5939 | 0;
    this._e = 0xffc00b31 | 0;
    this._f = 0x68581511 | 0;
    this._g = 0x64f98fa7 | 0;
    this._h = 0xbefa4fa4 | 0;
    return this;
  };
  Sha224.prototype._hash = function() {
    var H = new Buffer(28);
    H.writeInt32BE(this._a, 0);
    H.writeInt32BE(this._b, 4);
    H.writeInt32BE(this._c, 8);
    H.writeInt32BE(this._d, 12);
    H.writeInt32BE(this._e, 16);
    H.writeInt32BE(this._f, 20);
    H.writeInt32BE(this._g, 24);
    return H;
  };
  module.exports = Sha224;
})(require('buffer').Buffer);
