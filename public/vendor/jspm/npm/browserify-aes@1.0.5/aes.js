/* */ 
(function(Buffer) {
  var uint_max = Math.pow(2, 32);
  function fixup_uint32(x) {
    var ret,
        x_pos;
    ret = x > uint_max || x < 0 ? (x_pos = Math.abs(x) % uint_max, x < 0 ? uint_max - x_pos : x_pos) : x;
    return ret;
  }
  function scrub_vec(v) {
    for (var i = 0; i < v.length; v++) {
      v[i] = 0;
    }
    return false;
  }
  function Global() {
    this.SBOX = [];
    this.INV_SBOX = [];
    this.SUB_MIX = [[], [], [], []];
    this.INV_SUB_MIX = [[], [], [], []];
    this.init();
    this.RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  }
  Global.prototype.init = function() {
    var d,
        i,
        sx,
        t,
        x,
        x2,
        x4,
        x8,
        xi,
        _i;
    d = (function() {
      var _i,
          _results;
      _results = [];
      for (i = _i = 0; _i < 256; i = ++_i) {
        if (i < 128) {
          _results.push(i << 1);
        } else {
          _results.push((i << 1) ^ 0x11b);
        }
      }
      return _results;
    })();
    x = 0;
    xi = 0;
    for (i = _i = 0; _i < 256; i = ++_i) {
      sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
      sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
      this.SBOX[x] = sx;
      this.INV_SBOX[sx] = x;
      x2 = d[x];
      x4 = d[x2];
      x8 = d[x4];
      t = (d[sx] * 0x101) ^ (sx * 0x1010100);
      this.SUB_MIX[0][x] = (t << 24) | (t >>> 8);
      this.SUB_MIX[1][x] = (t << 16) | (t >>> 16);
      this.SUB_MIX[2][x] = (t << 8) | (t >>> 24);
      this.SUB_MIX[3][x] = t;
      t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
      this.INV_SUB_MIX[0][sx] = (t << 24) | (t >>> 8);
      this.INV_SUB_MIX[1][sx] = (t << 16) | (t >>> 16);
      this.INV_SUB_MIX[2][sx] = (t << 8) | (t >>> 24);
      this.INV_SUB_MIX[3][sx] = t;
      if (x === 0) {
        x = xi = 1;
      } else {
        x = x2 ^ d[d[d[x8 ^ x2]]];
        xi ^= d[d[xi]];
      }
    }
    return true;
  };
  var G = new Global();
  AES.blockSize = 4 * 4;
  AES.prototype.blockSize = AES.blockSize;
  AES.keySize = 256 / 8;
  AES.prototype.keySize = AES.keySize;
  function bufferToArray(buf) {
    var len = buf.length / 4;
    var out = new Array(len);
    var i = -1;
    while (++i < len) {
      out[i] = buf.readUInt32BE(i * 4);
    }
    return out;
  }
  function AES(key) {
    this._key = bufferToArray(key);
    this._doReset();
  }
  AES.prototype._doReset = function() {
    var invKsRow,
        keySize,
        keyWords,
        ksRow,
        ksRows,
        t;
    keyWords = this._key;
    keySize = keyWords.length;
    this._nRounds = keySize + 6;
    ksRows = (this._nRounds + 1) * 4;
    this._keySchedule = [];
    for (ksRow = 0; ksRow < ksRows; ksRow++) {
      this._keySchedule[ksRow] = ksRow < keySize ? keyWords[ksRow] : (t = this._keySchedule[ksRow - 1], (ksRow % keySize) === 0 ? (t = (t << 8) | (t >>> 24), t = (G.SBOX[t >>> 24] << 24) | (G.SBOX[(t >>> 16) & 0xff] << 16) | (G.SBOX[(t >>> 8) & 0xff] << 8) | G.SBOX[t & 0xff], t ^= G.RCON[(ksRow / keySize) | 0] << 24) : keySize > 6 && ksRow % keySize === 4 ? t = (G.SBOX[t >>> 24] << 24) | (G.SBOX[(t >>> 16) & 0xff] << 16) | (G.SBOX[(t >>> 8) & 0xff] << 8) | G.SBOX[t & 0xff] : void 0, this._keySchedule[ksRow - keySize] ^ t);
    }
    this._invKeySchedule = [];
    for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
      ksRow = ksRows - invKsRow;
      t = this._keySchedule[ksRow - (invKsRow % 4 ? 0 : 4)];
      this._invKeySchedule[invKsRow] = invKsRow < 4 || ksRow <= 4 ? t : G.INV_SUB_MIX[0][G.SBOX[t >>> 24]] ^ G.INV_SUB_MIX[1][G.SBOX[(t >>> 16) & 0xff]] ^ G.INV_SUB_MIX[2][G.SBOX[(t >>> 8) & 0xff]] ^ G.INV_SUB_MIX[3][G.SBOX[t & 0xff]];
    }
    return true;
  };
  AES.prototype.encryptBlock = function(M) {
    M = bufferToArray(new Buffer(M));
    var out = this._doCryptBlock(M, this._keySchedule, G.SUB_MIX, G.SBOX);
    var buf = new Buffer(16);
    buf.writeUInt32BE(out[0], 0);
    buf.writeUInt32BE(out[1], 4);
    buf.writeUInt32BE(out[2], 8);
    buf.writeUInt32BE(out[3], 12);
    return buf;
  };
  AES.prototype.decryptBlock = function(M) {
    M = bufferToArray(new Buffer(M));
    var temp = [M[3], M[1]];
    M[1] = temp[0];
    M[3] = temp[1];
    var out = this._doCryptBlock(M, this._invKeySchedule, G.INV_SUB_MIX, G.INV_SBOX);
    var buf = new Buffer(16);
    buf.writeUInt32BE(out[0], 0);
    buf.writeUInt32BE(out[3], 4);
    buf.writeUInt32BE(out[2], 8);
    buf.writeUInt32BE(out[1], 12);
    return buf;
  };
  AES.prototype.scrub = function() {
    scrub_vec(this._keySchedule);
    scrub_vec(this._invKeySchedule);
    scrub_vec(this._key);
  };
  AES.prototype._doCryptBlock = function(M, keySchedule, SUB_MIX, SBOX) {
    var ksRow,
        s0,
        s1,
        s2,
        s3,
        t0,
        t1,
        t2,
        t3;
    s0 = M[0] ^ keySchedule[0];
    s1 = M[1] ^ keySchedule[1];
    s2 = M[2] ^ keySchedule[2];
    s3 = M[3] ^ keySchedule[3];
    ksRow = 4;
    for (var round = 1; round < this._nRounds; round++) {
      t0 = SUB_MIX[0][s0 >>> 24] ^ SUB_MIX[1][(s1 >>> 16) & 0xff] ^ SUB_MIX[2][(s2 >>> 8) & 0xff] ^ SUB_MIX[3][s3 & 0xff] ^ keySchedule[ksRow++];
      t1 = SUB_MIX[0][s1 >>> 24] ^ SUB_MIX[1][(s2 >>> 16) & 0xff] ^ SUB_MIX[2][(s3 >>> 8) & 0xff] ^ SUB_MIX[3][s0 & 0xff] ^ keySchedule[ksRow++];
      t2 = SUB_MIX[0][s2 >>> 24] ^ SUB_MIX[1][(s3 >>> 16) & 0xff] ^ SUB_MIX[2][(s0 >>> 8) & 0xff] ^ SUB_MIX[3][s1 & 0xff] ^ keySchedule[ksRow++];
      t3 = SUB_MIX[0][s3 >>> 24] ^ SUB_MIX[1][(s0 >>> 16) & 0xff] ^ SUB_MIX[2][(s1 >>> 8) & 0xff] ^ SUB_MIX[3][s2 & 0xff] ^ keySchedule[ksRow++];
      s0 = t0;
      s1 = t1;
      s2 = t2;
      s3 = t3;
    }
    t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
    t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
    t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
    t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];
    return [fixup_uint32(t0), fixup_uint32(t1), fixup_uint32(t2), fixup_uint32(t3)];
  };
  exports.AES = AES;
})(require('buffer').Buffer);
