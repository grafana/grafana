/* */ 
(function(Buffer) {
  var xor = require('buffer-xor');
  function incr32(iv) {
    var len = iv.length;
    var item;
    while (len--) {
      item = iv.readUInt8(len);
      if (item === 255) {
        iv.writeUInt8(0, len);
      } else {
        item++;
        iv.writeUInt8(item, len);
        break;
      }
    }
  }
  function getBlock(self) {
    var out = self._cipher.encryptBlock(self._prev);
    incr32(self._prev);
    return out;
  }
  exports.encrypt = function(self, chunk) {
    while (self._cache.length < chunk.length) {
      self._cache = Buffer.concat([self._cache, getBlock(self)]);
    }
    var pad = self._cache.slice(0, chunk.length);
    self._cache = self._cache.slice(chunk.length);
    return xor(chunk, pad);
  };
})(require('buffer').Buffer);
