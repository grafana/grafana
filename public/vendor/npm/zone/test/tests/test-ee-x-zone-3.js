require('../common.js');

var EventEmitter = require('events').EventEmitter;

test.expect(3);
var step = 0;

zone.create(function OuterZone() {
  var emitter = new EventEmitter();

  zone.create(function InnerZone() {
    emitter.on('something', function() {
      test.equal(step++, 0);
    });

  }).then(function() {
    test.equal(step++, 1);
  });

  emitter.emit('something');

}).then(function() {
  test.equal(step++, 2);
});
