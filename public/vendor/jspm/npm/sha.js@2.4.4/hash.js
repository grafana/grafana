/* */ 
(function(Buffer) {
  function Hash(blockSize, finalSize) {
    this._block = new Buffer(blockSize);
    this._finalSize = finalSize;
    this._blockSize = blockSize;
    this._len = 0;
    this._s = 0;
  }
  Hash.prototype.update = function(data, enc) {
    if (typeof data === 'string') {
      enc = enc || 'utf8';
      data = new Buffer(data, enc);
    }
    var l = this._len += data.length;
    var s = this._s || 0;
    var f = 0;
    var buffer = this._block;
    while (s < l) {
      var t = Math.min(data.length, f + this._blockSize - (s % this._blockSize));
      var ch = (t - f);
      for (var i = 0; i < ch; i++) {
        buffer[(s % this._blockSize) + i] = data[i + f];
      }
      s += ch;
      f += ch;
      if ((s % this._blockSize) === 0) {
        this._update(buffer);
      }
    }
    this._s = s;
    return this;
  };
  Hash.prototype.digest = function(enc) {
    var l = this._len * 8;
    this._block[this._len % this._blockSize] = 0x80;
    this._block.fill(0, this._len % this._blockSize + 1);
    if (l % (this._blockSize * 8) >= this._finalSize * 8) {
      this._update(this._block);
      this._block.fill(0);
    }
    this._block.writeInt32BE(l, this._blockSize - 4);
    var hash = this._update(this._block) || this._hash();
    return enc ? hash.toString(enc) : hash;
  };
  Hash.prototype._update = function() {
    throw new Error('_update must be implemented by subclass');
  };
  module.exports = Hash;
})(require('buffer').Buffer);
