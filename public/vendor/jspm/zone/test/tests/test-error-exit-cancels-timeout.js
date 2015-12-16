require('../common.js');

// Timeouts can be cancelled so Zone should not wait for it.
test.expect(1);

var fs = require('fs');
var cleanupOrder = [];

zone.create(function ChildZone1() {
  zone.create(function ChildZone2() {
    zone.create(function ChildZone3() {
      process.setTimeout(function() {
        cleanupOrder.push('timeout complete');
      }, 5000);

      throw new Error('monkey wrench');
    }).catch (function() {
      cleanupOrder.push('exception caught');
    });
  });
}).then(function() {
  test.deepEqual(cleanupOrder, ['exception caught']);
  test.done();
});
