/* */ 
(function(Buffer) {
  function encryptByte(self, byteParam, decrypt) {
    var pad = self._cipher.encryptBlock(self._prev);
    var out = pad[0] ^ byteParam;
    self._prev = Buffer.concat([self._prev.slice(1), new Buffer([decrypt ? byteParam : out])]);
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
})(require('buffer').Buffer);
