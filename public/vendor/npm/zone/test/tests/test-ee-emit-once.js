require('../common.js');

var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var listener = function(data) { test.ok(true); };
var done = function(data) { test.done(); };

test.expect(1);
emitter.once('myevent', listener);
emitter.once('done', done);
emitter.emit('myevent', 'FOO');
emitter.emit('myevent', 'FOO');
emitter.emit('done', 'done');
