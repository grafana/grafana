require('../common.js');

test.expect(2);

var zoneFunc = function() {  // no-op
};

var cb = function(err) {
  test.strictEqual(err, null);
  test.strictEqual(arguments.length, 1);
  test.done();
};

zone.create(zoneFunc).setCallback(cb);
