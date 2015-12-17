require('../common.js');

var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
test.expect(2);

var ChildZone = function ChildZone(test, emitter) {
  setTimeout(function() {
    test.ok(true);
    emitter.emit('myevent', 'FOO');
  }, 10);

  emitter.once('myevent', function(ray) { test.equal(ray, 'FOO'); });
};

var doneCB = function() { test.done(); };

c = zone.define(ChildZone, {successCallback: doneCB});
c(test, emitter);
