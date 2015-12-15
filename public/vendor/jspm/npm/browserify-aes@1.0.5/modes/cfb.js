/* */ 
(function(Buffer) {
  var xor = require('buffer-xor');
  exports.encrypt = function(self, data, decrypt) {
    var out = new Buffer('');
    var len;
    while (data.length) {
      if (self._cache.length === 0) {
        self._cache = self._cipher.encryptBlock(self._prev);
        self._prev = new Buffer('');
      }
      if (self._cache.length <= data.length) {
        len = self._cache.length;
        out = Buffer.concat([out, encryptStart(self, data.slice(0, len), decrypt)]);
        data = data.slice(len);
      } else {
        out = Buffer.concat([out, encryptStart(self, data, decrypt)]);
        break;
      }
    }
    return out;
  };
  function encryptStart(self, data, decrypt) {
    var len = data.length;
    var out = xor(data, self._cache);
    self._cache = self._cache.slice(len);
    self._prev = Buffer.concat([self._prev, decrypt ? data : out]);
    return out;
  }
})(require('buffer').Buffer);
