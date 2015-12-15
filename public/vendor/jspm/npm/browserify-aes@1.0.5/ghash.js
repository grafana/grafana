/* */ 
(function(Buffer) {
  var zeros = new Buffer(16);
  zeros.fill(0);
  module.exports = GHASH;
  function GHASH(key) {
    this.h = key;
    this.state = new Buffer(16);
    this.state.fill(0);
    this.cache = new Buffer('');
  }
  GHASH.prototype.ghash = function(block) {
    var i = -1;
    while (++i < block.length) {
      this.state[i] ^= block[i];
    }
    this._multiply();
  };
  GHASH.prototype._multiply = function() {
    var Vi = toArray(this.h);
    var Zi = [0, 0, 0, 0];
    var j,
        xi,
        lsb_Vi;
    var i = -1;
    while (++i < 128) {
      xi = (this.state[~~(i / 8)] & (1 << (7 - i % 8))) !== 0;
      if (xi) {
        Zi = xor(Zi, Vi);
      }
      lsb_Vi = (Vi[3] & 1) !== 0;
      for (j = 3; j > 0; j--) {
        Vi[j] = (Vi[j] >>> 1) | ((Vi[j - 1] & 1) << 31);
      }
      Vi[0] = Vi[0] >>> 1;
      if (lsb_Vi) {
        Vi[0] = Vi[0] ^ (0xe1 << 24);
      }
    }
    this.state = fromArray(Zi);
  };
  GHASH.prototype.update = function(buf) {
    this.cache = Buffer.concat([this.cache, buf]);
    var chunk;
    while (this.cache.length >= 16) {
      chunk = this.cache.slice(0, 16);
      this.cache = this.cache.slice(16);
      this.ghash(chunk);
    }
  };
  GHASH.prototype.final = function(abl, bl) {
    if (this.cache.length) {
      this.ghash(Buffer.concat([this.cache, zeros], 16));
    }
    this.ghash(fromArray([0, abl, 0, bl]));
    return this.state;
  };
  function toArray(buf) {
    return [buf.readUInt32BE(0), buf.readUInt32BE(4), buf.readUInt32BE(8), buf.readUInt32BE(12)];
  }
  function fromArray(out) {
    out = out.map(fixup_uint32);
    var buf = new Buffer(16);
    buf.writeUInt32BE(out[0], 0);
    buf.writeUInt32BE(out[1], 4);
    buf.writeUInt32BE(out[2], 8);
    buf.writeUInt32BE(out[3], 12);
    return buf;
  }
  var uint_max = Math.pow(2, 32);
  function fixup_uint32(x) {
    var ret,
        x_pos;
    ret = x > uint_max || x < 0 ? (x_pos = Math.abs(x) % uint_max, x < 0 ? uint_max - x_pos : x_pos) : x;
    return ret;
  }
  function xor(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1], a[2] ^ b[2], a[3] ^ b[3]];
  }
})(require('buffer').Buffer);
