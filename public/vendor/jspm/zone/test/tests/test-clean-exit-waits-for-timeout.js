require('../common.js');

// If there is no error, Zones should wait for timeouts.

test.expect(1);

var fs = require('fs');
var cleanupOrder = [];

zone.create(function ChildZone1() {
  zone.create(function ChildZone2() {
    zone.create(function ChildZone3() {
      setTimeout(function() {
        cleanupOrder.push('timeout complete');
      }, 50);
    }).then(function() {
      cleanupOrder.push('ChildZone3 exit');
    });
  });
}).then(function() {
  test.deepEqual(cleanupOrder, ['timeout complete', 'ChildZone3 exit']);
  test.done();
});
