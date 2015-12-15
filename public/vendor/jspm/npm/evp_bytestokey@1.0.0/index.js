/* */ 
(function(Buffer) {
  var md5 = require('create-hash/md5');
  module.exports = EVP_BytesToKey;
  function EVP_BytesToKey(password, salt, keyLen, ivLen) {
    if (!Buffer.isBuffer(password)) {
      password = new Buffer(password, 'binary');
    }
    if (salt && !Buffer.isBuffer(salt)) {
      salt = new Buffer(salt, 'binary');
    }
    keyLen = keyLen / 8;
    ivLen = ivLen || 0;
    var ki = 0;
    var ii = 0;
    var key = new Buffer(keyLen);
    var iv = new Buffer(ivLen);
    var addmd = 0;
    var md_buf;
    var i;
    var bufs = [];
    while (true) {
      if (addmd++ > 0) {
        bufs.push(md_buf);
      }
      bufs.push(password);
      if (salt) {
        bufs.push(salt);
      }
      md_buf = md5(Buffer.concat(bufs));
      bufs = [];
      i = 0;
      if (keyLen > 0) {
        while (true) {
          if (keyLen === 0) {
            break;
          }
          if (i === md_buf.length) {
            break;
          }
          key[ki++] = md_buf[i];
          keyLen--;
          i++;
        }
      }
      if (ivLen > 0 && i !== md_buf.length) {
        while (true) {
          if (ivLen === 0) {
            break;
          }
          if (i === md_buf.length) {
            break;
          }
          iv[ii++] = md_buf[i];
          ivLen--;
          i++;
        }
      }
      if (keyLen === 0 && ivLen === 0) {
        break;
      }
    }
    for (i = 0; i < md_buf.length; i++) {
      md_buf[i] = 0;
    }
    return {
      key: key,
      iv: iv
    };
  }
})(require('buffer').Buffer);
