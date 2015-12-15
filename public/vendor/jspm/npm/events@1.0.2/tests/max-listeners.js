/* */ 
var assert = require('assert');
var events = require('../events');
var gotEvent = false;
var e = new events.EventEmitter();
e.on('maxListeners', function() {
  gotEvent = true;
});
e.setMaxListeners(42);
assert.throws(function() {
  e.setMaxListeners(NaN);
});
assert.throws(function() {
  e.setMaxListeners(-1);
});
assert.throws(function() {
  e.setMaxListeners("and even this");
});
e.emit('maxListeners');
assert(gotEvent);
