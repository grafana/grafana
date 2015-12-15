/* */ 
(function(Buffer) {
  var inherits = require('inherits');
  var Hash = require('./hash');
  var K = [0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2, 0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5, 0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df, 0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8, 0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec, 0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b, 0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817];
  var W = new Array(160);
  function Sha512() {
    this.init();
    this._w = W;
    Hash.call(this, 128, 112);
  }
  inherits(Sha512, Hash);
  Sha512.prototype.init = function() {
    this._a = 0x6a09e667 | 0;
    this._b = 0xbb67ae85 | 0;
    this._c = 0x3c6ef372 | 0;
    this._d = 0xa54ff53a | 0;
    this._e = 0x510e527f | 0;
    this._f = 0x9b05688c | 0;
    this._g = 0x1f83d9ab | 0;
    this._h = 0x5be0cd19 | 0;
    this._al = 0xf3bcc908 | 0;
    this._bl = 0x84caa73b | 0;
    this._cl = 0xfe94f82b | 0;
    this._dl = 0x5f1d36f1 | 0;
    this._el = 0xade682d1 | 0;
    this._fl = 0x2b3e6c1f | 0;
    this._gl = 0xfb41bd6b | 0;
    this._hl = 0x137e2179 | 0;
    return this;
  };
  function Ch(x, y, z) {
    return z ^ (x & (y ^ z));
  }
  function Maj(x, y, z) {
    return (x & y) | (z & (x | y));
  }
  function Sigma0(x, xl) {
    return (x >>> 28 | xl << 4) ^ (xl >>> 2 | x << 30) ^ (xl >>> 7 | x << 25);
  }
  function Sigma1(x, xl) {
    return (x >>> 14 | xl << 18) ^ (x >>> 18 | xl << 14) ^ (xl >>> 9 | x << 23);
  }
  function Gamma0(x, xl) {
    return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7);
  }
  function Gamma0l(x, xl) {
    return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7 | xl << 25);
  }
  function Gamma1(x, xl) {
    return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6);
  }
  function Gamma1l(x, xl) {
    return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6 | xl << 26);
  }
  Sha512.prototype._update = function(M) {
    var W = this._w;
    var a = this._a | 0;
    var b = this._b | 0;
    var c = this._c | 0;
    var d = this._d | 0;
    var e = this._e | 0;
    var f = this._f | 0;
    var g = this._g | 0;
    var h = this._h | 0;
    var al = this._al | 0;
    var bl = this._bl | 0;
    var cl = this._cl | 0;
    var dl = this._dl | 0;
    var el = this._el | 0;
    var fl = this._fl | 0;
    var gl = this._gl | 0;
    var hl = this._hl | 0;
    var i = 0;
    var j = 0;
    var Wi,
        Wil;
    function calcW() {
      var x = W[j - 15 * 2];
      var xl = W[j - 15 * 2 + 1];
      var gamma0 = Gamma0(x, xl);
      var gamma0l = Gamma0l(xl, x);
      x = W[j - 2 * 2];
      xl = W[j - 2 * 2 + 1];
      var gamma1 = Gamma1(x, xl);
      var gamma1l = Gamma1l(xl, x);
      var Wi7 = W[j - 7 * 2];
      var Wi7l = W[j - 7 * 2 + 1];
      var Wi16 = W[j - 16 * 2];
      var Wi16l = W[j - 16 * 2 + 1];
      Wil = gamma0l + Wi7l;
      Wi = gamma0 + Wi7 + ((Wil >>> 0) < (gamma0l >>> 0) ? 1 : 0);
      Wil = Wil + gamma1l;
      Wi = Wi + gamma1 + ((Wil >>> 0) < (gamma1l >>> 0) ? 1 : 0);
      Wil = Wil + Wi16l;
      Wi = Wi + Wi16 + ((Wil >>> 0) < (Wi16l >>> 0) ? 1 : 0);
    }
    function loop() {
      W[j] = Wi;
      W[j + 1] = Wil;
      var maj = Maj(a, b, c);
      var majl = Maj(al, bl, cl);
      var sigma0h = Sigma0(a, al);
      var sigma0l = Sigma0(al, a);
      var sigma1h = Sigma1(e, el);
      var sigma1l = Sigma1(el, e);
      var Ki = K[j];
      var Kil = K[j + 1];
      var ch = Ch(e, f, g);
      var chl = Ch(el, fl, gl);
      var t1l = hl + sigma1l;
      var t1 = h + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0);
      t1l = t1l + chl;
      t1 = t1 + ch + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0);
      t1l = t1l + Kil;
      t1 = t1 + Ki + ((t1l >>> 0) < (Kil >>> 0) ? 1 : 0);
      t1l = t1l + Wil;
      t1 = t1 + Wi + ((t1l >>> 0) < (Wil >>> 0) ? 1 : 0);
      var t2l = sigma0l + majl;
      var t2 = sigma0h + maj + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0);
      h = g;
      hl = gl;
      g = f;
      gl = fl;
      f = e;
      fl = el;
      el = (dl + t1l) | 0;
      e = (d + t1 + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
      d = c;
      dl = cl;
      c = b;
      cl = bl;
      b = a;
      bl = al;
      al = (t1l + t2l) | 0;
      a = (t1 + t2 + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0;
      i++;
      j += 2;
    }
    while (i < 16) {
      Wi = M.readInt32BE(j * 4);
      Wil = M.readInt32BE(j * 4 + 4);
      loop();
    }
    while (i < 80) {
      calcW();
      loop();
    }
    this._al = (this._al + al) | 0;
    this._bl = (this._bl + bl) | 0;
    this._cl = (this._cl + cl) | 0;
    this._dl = (this._dl + dl) | 0;
    this._el = (this._el + el) | 0;
    this._fl = (this._fl + fl) | 0;
    this._gl = (this._gl + gl) | 0;
    this._hl = (this._hl + hl) | 0;
    this._a = (this._a + a + ((this._al >>> 0) < (al >>> 0) ? 1 : 0)) | 0;
    this._b = (this._b + b + ((this._bl >>> 0) < (bl >>> 0) ? 1 : 0)) | 0;
    this._c = (this._c + c + ((this._cl >>> 0) < (cl >>> 0) ? 1 : 0)) | 0;
    this._d = (this._d + d + ((this._dl >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
    this._e = (this._e + e + ((this._el >>> 0) < (el >>> 0) ? 1 : 0)) | 0;
    this._f = (this._f + f + ((this._fl >>> 0) < (fl >>> 0) ? 1 : 0)) | 0;
    this._g = (this._g + g + ((this._gl >>> 0) < (gl >>> 0) ? 1 : 0)) | 0;
    this._h = (this._h + h + ((this._hl >>> 0) < (hl >>> 0) ? 1 : 0)) | 0;
  };
  Sha512.prototype._hash = function() {
    var H = new Buffer(64);
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
    writeInt64BE(this._g, this._gl, 48);
    writeInt64BE(this._h, this._hl, 56);
    return H;
  };
  module.exports = Sha512;
})(require('buffer').Buffer);
