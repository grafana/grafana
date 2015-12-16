require('../common.js');

// If children don't have a catch block, errors should propagate to parent.
test.expect(1);

var cleanupOrder = [];

zone.create(function ChildZone1() {
  zone.create(function ChildZone2() {
    zone.create(function ChildZone3() {
      process.nextTick(function() {
        throw new Error('monkey wrench');
      });
    });
  });
}).catch (function() {
  test.ok(true, 'Error was propogated');
  test.done();
});
