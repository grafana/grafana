require('../common.js');

// Test catch callback.
test.expect(1);

var zoneFunc = function() {
  zone.throw(new Error());
};

var cb = function(err) {
  test.ok(err instanceof Error);
  test.done();
};

zone.create(zoneFunc).catch (cb);
