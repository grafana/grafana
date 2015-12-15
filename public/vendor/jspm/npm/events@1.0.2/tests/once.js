/* */ 
var assert = require('assert');
var events = require('../events');
var e = new events.EventEmitter();
var times_hello_emited = 0;
e.once('hello', function(a, b) {
  times_hello_emited++;
});
e.emit('hello', 'a', 'b');
e.emit('hello', 'a', 'b');
e.emit('hello', 'a', 'b');
e.emit('hello', 'a', 'b');
var remove = function() {
  assert.fail(1, 0, 'once->foo should not be emitted', '!');
};
e.once('foo', remove);
e.removeListener('foo', remove);
e.emit('foo');
var times_recurse_emitted = 0;
e.once('e', function() {
  e.emit('e');
  times_recurse_emitted++;
});
e.once('e', function() {
  times_recurse_emitted++;
});
e.emit('e');
assert.equal(1, times_hello_emited);
assert.equal(2, times_recurse_emitted);
