/* */ 
(function(Buffer) {
  var test = require('tape');
  var algorithms = ['sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'SHA512', 'md5', 'rmd160'];
  var formats = [undefined, 'base64', 'hex', 'binary'];
  var vectors = require('hash-test-vectors/hmac');
  var createHmac = require('./browser');
  algorithms.forEach(function(alg) {
    vectors.forEach(function(input) {
      var key = new Buffer(input.key, 'hex');
      var inputBuffer = new Buffer(input.data, 'hex');
      formats.forEach(function(format) {
        test('hmac(' + alg + ') w/ ' + input.data.slice(0, 6) + '... as ' + format, function(t) {
          var hmac = createHmac(alg, key);
          var formattedInput = format ? inputBuffer.toString(format) : inputBuffer;
          hmac.update(formattedInput, format);
          var formattedOutput = hmac.digest(format);
          var output = new Buffer(formattedOutput, format);
          var truncated = input.truncate ? output.slice(0, input.truncate) : output;
          t.equal(truncated.toString('hex'), input[alg.toLowerCase()]);
          t.end();
        });
      });
    });
    vectors.forEach(function(input) {
      test('hmac(' + alg + ') as stream w/ ' + input.data.slice(0, 6) + '...', function(t) {
        var hmac = createHmac(alg, new Buffer(input.key, 'hex'));
        hmac.end(input.data, 'hex');
        var output = hmac.read();
        var truncated = input.truncate ? output.slice(0, input.truncate) : output;
        t.equal(truncated.toString('hex'), input[alg.toLowerCase()]);
        t.end();
      });
    });
  });
})(require('buffer').Buffer);
