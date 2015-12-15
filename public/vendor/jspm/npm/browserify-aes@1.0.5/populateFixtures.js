/* */ 
(function(Buffer) {
  var modes = require('./modes');
  var fixtures = require('./test/fixtures.json!systemjs-json');
  var crypto = require('crypto');
  var types = ['aes-128-cfb1', 'aes-192-cfb1', 'aes-256-cfb1'];
  var ebtk = require('./EVP_BytesToKey');
  var fs = require('fs');
  fixtures.forEach(function(fixture) {
    types.forEach(function(cipher) {
      var suite = crypto.createCipher(cipher, new Buffer(fixture.password));
      var buf = new Buffer('');
      buf = Buffer.concat([buf, suite.update(new Buffer(fixture.text))]);
      buf = Buffer.concat([buf, suite.final()]);
      fixture.results.ciphers[cipher] = buf.toString('hex');
      if (modes[cipher].mode === 'ECB') {
        return;
      }
      var suite2 = crypto.createCipheriv(cipher, ebtk(crypto, fixture.password, modes[cipher].key).key, new Buffer(fixture.iv, 'hex'));
      var buf2 = new Buffer('');
      buf2 = Buffer.concat([buf2, suite2.update(new Buffer(fixture.text))]);
      buf2 = Buffer.concat([buf2, suite2.final()]);
      fixture.results.cipherivs[cipher] = buf2.toString('hex');
    });
  });
  fs.writeFileSync('./test/fixturesNew.json', JSON.stringify(fixtures, false, 4));
})(require('buffer').Buffer);
