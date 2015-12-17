require('../common.js');

var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

test.expect(2);
setTimeout(function() {
  test.ok(true);
  emitter.emit('myevent', 'FOO');
}, 10);

emitter.on('myevent', function(ray) {
  test.equal(ray, 'FOO');
  test.done();
});
