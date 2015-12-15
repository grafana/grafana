/* */ 
(function(Buffer) {
  var createHmac = require('create-hmac');
  var MAX_ALLOC = Math.pow(2, 30) - 1;
  exports.pbkdf2 = pbkdf2;
  function pbkdf2(password, salt, iterations, keylen, digest, callback) {
    if (typeof digest === 'function') {
      callback = digest;
      digest = undefined;
    }
    if (typeof callback !== 'function') {
      throw new Error('No callback provided to pbkdf2');
    }
    var result = pbkdf2Sync(password, salt, iterations, keylen, digest);
    setTimeout(function() {
      callback(undefined, result);
    });
  }
  exports.pbkdf2Sync = pbkdf2Sync;
  function pbkdf2Sync(password, salt, iterations, keylen, digest) {
    if (typeof iterations !== 'number') {
      throw new TypeError('Iterations not a number');
    }
    if (iterations < 0) {
      throw new TypeError('Bad iterations');
    }
    if (typeof keylen !== 'number') {
      throw new TypeError('Key length not a number');
    }
    if (keylen < 0 || keylen > MAX_ALLOC) {
      throw new TypeError('Bad key length');
    }
    digest = digest || 'sha1';
    if (!Buffer.isBuffer(password))
      password = new Buffer(password, 'binary');
    if (!Buffer.isBuffer(salt))
      salt = new Buffer(salt, 'binary');
    var hLen;
    var l = 1;
    var DK = new Buffer(keylen);
    var block1 = new Buffer(salt.length + 4);
    salt.copy(block1, 0, 0, salt.length);
    var r;
    var T;
    for (var i = 1; i <= l; i++) {
      block1.writeUInt32BE(i, salt.length);
      var U = createHmac(digest, password).update(block1).digest();
      if (!hLen) {
        hLen = U.length;
        T = new Buffer(hLen);
        l = Math.ceil(keylen / hLen);
        r = keylen - (l - 1) * hLen;
      }
      U.copy(T, 0, 0, hLen);
      for (var j = 1; j < iterations; j++) {
        U = createHmac(digest, password).update(U).digest();
        for (var k = 0; k < hLen; k++) {
          T[k] ^= U[k];
        }
      }
      var destPos = (i - 1) * hLen;
      var len = (i === l ? r : hLen);
      T.copy(DK, destPos, 0, len);
    }
    return DK;
  }
})(require('buffer').Buffer);
