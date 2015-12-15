/* */ 
(function(Buffer) {
  var inherits = require('inherits');
  var SHA512 = require('./sha512');
  var Hash = require('./hash');
  var W = new Array(160);
  function Sha384() {
    this.init();
    this._w = W;
    Hash.call(this, 128, 112);
  }
  inherits(Sha384, SHA512);
  Sha384.prototype.init = function() {
    this._a = 0xcbbb9d5d | 0;
    this._b = 0x629a292a | 0;
    this._c = 0x9159015a | 0;
    this._d = 0x152fecd8 | 0;
    this._e = 0x67332667 | 0;
    this._f = 0x8eb44a87 | 0;
    this._g = 0xdb0c2e0d | 0;
    this._h = 0x47b5481d | 0;
    this._al = 0xc1059ed8 | 0;
    this._bl = 0x367cd507 | 0;
    this._cl = 0x3070dd17 | 0;
    this._dl = 0xf70e5939 | 0;
    this._el = 0xffc00b31 | 0;
    this._fl = 0x68581511 | 0;
    this._gl = 0x64f98fa7 | 0;
    this._hl = 0xbefa4fa4 | 0;
    return this;
  };
  Sha384.prototype._hash = function() {
    var H = new Buffer(48);
    function writeInt64BE(h, l, offset) {
      H.writeInt32BE(h, offset);
      H.writeInt32BE(l, offset + 4);
    }
    writeInt64BE(this._a, this._al, 0);
    writeInt64BE(this._b, this._bl, 8);
    writeInt64BE(this._c, this._cl, 16);
    writeInt64BE(this._d, this._dl, 24);
    writeInt64BE(this._e, this._el, 32);
    writeInt64BE(this._f, this._fl, 40);
    return H;
  };
  module.exports = Sha384;
})(require('buffer').Buffer);
