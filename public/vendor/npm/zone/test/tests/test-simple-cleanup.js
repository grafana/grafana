require('../common.js');

// In the synchronous case, zones should clean up in child -> parent order.
test.expect(1);

var cleanupOrder = [];

zone.create(function ChildZone1() {
  zone.create(function ChildZone2() {
    zone.create(function ChildZone3() {

    }).then(function() {
      cleanupOrder.push('ChildZone3');
    });
  }).then(function() {
    cleanupOrder.push('ChildZone2');
  });
}).then(function() {
  cleanupOrder.push('ChildZone1');
  test.deepEqual(cleanupOrder, ['ChildZone3', 'ChildZone2', 'ChildZone1']);
  test.done();
});
