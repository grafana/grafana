/* */ 
(function(Buffer) {
  var test = require('tape');
  var crypto = require('../index');
  var randomBytesFunctions = {
    randomBytes: require('randombytes'),
    pseudoRandomBytes: crypto.pseudoRandomBytes
  };
  for (var randomBytesName in randomBytesFunctions) {
    var randomBytes = randomBytesFunctions[randomBytesName];
    test('get error message', function(t) {
      try {
        var b = randomBytes(10);
        t.ok(Buffer.isBuffer(b));
        t.end();
      } catch (err) {
        t.ok(/not supported/.test(err.message), '"not supported"  is in error message');
        t.end();
      }
    });
    test(randomBytesName, function(t) {
      t.plan(5);
      t.equal(randomBytes(10).length, 10);
      t.ok(Buffer.isBuffer(randomBytes(10)));
      randomBytes(10, function(ex, bytes) {
        t.error(ex);
        t.equal(bytes.length, 10);
        t.ok(Buffer.isBuffer(bytes));
        t.end();
      });
    });
    test(randomBytesName + ' seem random', function(t) {
      var L = 1000;
      var b = randomBytes(L);
      var mean = [].reduce.call(b, function(a, b) {
        return a + b;
      }, 0) / L;
      var expected = 256 / 2;
      var smean = Math.sqrt(mean);
      console.log(JSON.stringify([expected - smean, mean, expected + smean]));
      t.ok(mean < expected + smean);
      t.ok(mean > expected - smean);
      t.end();
    });
  }
})(require('buffer').Buffer);
