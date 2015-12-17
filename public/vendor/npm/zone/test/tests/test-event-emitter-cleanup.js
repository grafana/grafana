require('../common.js');

// A throw within a zone should cause the listener to unregister from the
// emitter.
test.expect(1);

var EventEmitter = require('events').EventEmitter;
var cleanupOrder = [];

zone.create(function ChildZone1() {
  var emitter = new EventEmitter();

  zone.create(function ChildZone() {
    emitter.on('event', function() {
      cleanupOrder.push('event reveived');
    });
    emitter.on('throw', function() {
      cleanupOrder.push('throw reveived');
      throw new Error('monkey wrench');
    });
  }).catch (function(err) {
    cleanupOrder.push('ChildZone exited');
  });

  process.nextTick(function() {
    emitter.emit('event', 'foo');
  });
  process.nextTick(function() {
    emitter.emit('throw', 'foo');
  });
  setTimeout(function() {
    //this event should not trigger the listener
    emitter.emit('event', 'foo');
  }, 50);
}).then(function() {
  test.deepEqual(cleanupOrder,
      ['event reveived', 'throw reveived', 'ChildZone exited']);
  test.done();
});
