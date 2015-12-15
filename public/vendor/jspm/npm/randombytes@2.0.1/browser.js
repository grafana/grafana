/* */ 
(function(Buffer, process) {
  'use strict';
  var crypto = global.crypto || global.msCrypto;
  if (crypto && crypto.getRandomValues) {
    module.exports = randomBytes;
  } else {
    module.exports = oldBrowser;
  }
  function randomBytes(size, cb) {
    var bytes = new Buffer(size);
    crypto.getRandomValues(bytes);
    if (typeof cb === 'function') {
      return process.nextTick(function() {
        cb(null, bytes);
      });
    }
    return bytes;
  }
  function oldBrowser() {
    throw new Error('secure random number generation not supported by this browser\n' + 'use chrome, FireFox or Internet Explorer 11');
  }
})(require('buffer').Buffer, require('process'));
