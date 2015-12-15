/* */ 
(function(Buffer) {
  var findProc = /Proc-Type: 4,ENCRYPTED\r?\nDEK-Info: AES-((?:128)|(?:192)|(?:256))-CBC,([0-9A-H]+)\r?\n\r?\n([0-9A-z\n\r\+\/\=]+)\r?\n/m;
  var startRegex = /^-----BEGIN (.*) KEY-----\r?\n/m;
  var fullRegex = /^-----BEGIN (.*) KEY-----\r?\n([0-9A-z\n\r\+\/\=]+)\r?\n-----END \1 KEY-----$/m;
  var evp = require('evp_bytestokey');
  var ciphers = require('browserify-aes');
  module.exports = function(okey, password) {
    var key = okey.toString();
    var match = key.match(findProc);
    var decrypted;
    if (!match) {
      var match2 = key.match(fullRegex);
      decrypted = new Buffer(match2[2].replace(/\r?\n/g, ''), 'base64');
    } else {
      var suite = 'aes' + match[1];
      var iv = new Buffer(match[2], 'hex');
      var cipherText = new Buffer(match[3].replace(/\r?\n/g, ''), 'base64');
      var cipherKey = evp(password, iv.slice(0, 8), parseInt(match[1], 10)).key;
      var out = [];
      var cipher = ciphers.createDecipheriv(suite, cipherKey, iv);
      out.push(cipher.update(cipherText));
      out.push(cipher.final());
      decrypted = Buffer.concat(out);
    }
    var tag = key.match(startRegex)[1] + ' KEY';
    return {
      tag: tag,
      data: decrypted
    };
  };
})(require('buffer').Buffer);
