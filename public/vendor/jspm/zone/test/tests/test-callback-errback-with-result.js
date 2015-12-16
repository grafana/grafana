require('../common.js');

test.expect(3);

var zoneFunc = function() {
  zone.return(42);
};

var cb = function(err, a, b) {
  test.strictEqual(err, null);
  test.strictEqual(a, 42);
  test.strictEqual(b, undefined);
  test.done();
};

zone.create(zoneFunc).setCallback(cb);
