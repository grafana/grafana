require('../common.js');

test.expect(2);

var zoneFunc = function() {
  throw 133;
};

var cb = function(err) {
  test.ok(err instanceof Error);
  test.strictEqual(err.value, 133);
  test.done();
};

zone.create(zoneFunc).catch (cb);
