/* */ 
(function(Buffer) {
  var inherits = require('inherits');
  var Hash = require('./hash');
  var W = new Array(80);
  function Sha1() {
    this.init();
    this._w = W;
    Hash.call(this, 64, 56);
  }
  inherits(Sha1, Hash);
  Sha1.prototype.init = function() {
    this._a = 0x67452301 | 0;
    this._b = 0xefcdab89 | 0;
    this._c = 0x98badcfe | 0;
    this._d = 0x10325476 | 0;
    this._e = 0xc3d2e1f0 | 0;
    return this;
  };
  function rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  Sha1.prototype._update = function(M) {
    var W = this._w;
    var a = this._a;
    var b = this._b;
    var c = this._c;
    var d = this._d;
    var e = this._e;
    var j = 0;
    var k;
    function calcW() {
      return rol(W[j - 3] ^ W[j - 8] ^ W[j - 14] ^ W[j - 16], 1);
    }
    function loop(w, f) {
      W[j] = w;
      var t = rol(a, 5) + f + e + w + k;
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
      j++;
    }
    k = 1518500249;
    while (j < 16)
      loop(M.readInt32BE(j * 4), (b & c) | ((~b) & d));
    while (j < 20)
      loop(calcW(), (b & c) | ((~b) & d));
    k = 1859775393;
    while (j < 40)
      loop(calcW(), b ^ c ^ d);
    k = -1894007588;
    while (j < 60)
      loop(calcW(), (b & c) | (b & d) | (c & d));
    k = -899497514;
    while (j < 80)
      loop(calcW(), b ^ c ^ d);
    this._a = (a + this._a) | 0;
    this._b = (b + this._b) | 0;
    this._c = (c + this._c) | 0;
    this._d = (d + this._d) | 0;
    this._e = (e + this._e) | 0;
  };
  Sha1.prototype._hash = function() {
    var H = new Buffer(20);
    H.writeInt32BE(this._a | 0, 0);
    H.writeInt32BE(this._b | 0, 4);
    H.writeInt32BE(this._c | 0, 8);
    H.writeInt32BE(this._d | 0, 12);
    H.writeInt32BE(this._e | 0, 16);
    return H;
  };
  module.exports = Sha1;
})(require('buffer').Buffer);
