require('../common.js');

//Zones should wait for async operations before completing

var fs = require('fs');
var cleanupOrder = [];

zone.create(function ChildZone1() {
  zone.create(function ChildZone2() {
    var z = zone.create(function ChildZone3() {
      fs.stat(__dirname + '/../assets/file1', function(err) {
        cleanupOrder.push('fs.stat complete');
      });

    }).then(function() {
      cleanupOrder.push('ChildZone3 exit');
    });
  });
}).then(function() {
  //test.deepEqual(cleanupOrder, ['fs.stat complete', 'ChildZone3 exit']);
});
