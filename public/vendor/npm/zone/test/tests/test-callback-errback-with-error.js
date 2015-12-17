require('../common.js');

test.expect(3);

var zoneFunc = function() {
  zone.return(42);
  throw new Error();
};

var cb = function(err, a, b) {
  test.ok(err instanceof Error);
  test.equal(a, undefined);
  test.equal(b, undefined);
  test.done();
};
zone.create(zoneFunc).setCallback(cb);
