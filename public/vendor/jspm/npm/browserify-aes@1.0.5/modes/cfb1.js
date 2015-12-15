/* */ 
(function(Buffer) {
  function encryptByte(self, byteParam, decrypt) {
    var pad;
    var i = -1;
    var len = 8;
    var out = 0;
    var bit,
        value;
    while (++i < len) {
      pad = self._cipher.encryptBlock(self._prev);
      bit = (byteParam & (1 << (7 - i))) ? 0x80 : 0;
      value = pad[0] ^ bit;
      out += ((value & 0x80) >> (i % 8));
      self._prev = shiftIn(self._prev, decrypt ? bit : value);
    }
    return out;
  }
  exports.encrypt = function(self, chunk, decrypt) {
    var len = chunk.length;
    var out = new Buffer(len);
    var i = -1;
    while (++i < len) {
      out[i] = encryptByte(self, chunk[i], decrypt);
    }
    return out;
  };
  function shiftIn(buffer, value) {
    var len = buffer.length;
    var i = -1;
    var out = new Buffer(buffer.length);
    buffer = Buffer.concat([buffer, new Buffer([value])]);
    while (++i < len) {
      out[i] = buffer[i] << 1 | buffer[i + 1] >> (7);
    }
    return out;
  }
})(require('buffer').Buffer);
