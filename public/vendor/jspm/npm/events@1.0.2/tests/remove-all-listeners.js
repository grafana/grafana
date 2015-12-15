/* */ 
var common = require('./common');
var assert = require('assert');
var events = require('../events');
var after_checks = [];
after(function() {
  for (var i = 0; i < after_checks.length; ++i) {
    after_checks[i]();
  }
});
function expect(expected) {
  var actual = [];
  after_checks.push(function() {
    assert.deepEqual(actual.sort(), expected.sort());
  });
  function listener(name) {
    actual.push(name);
  }
  return common.mustCall(listener, expected.length);
}
function listener() {}
var e1 = new events.EventEmitter();
e1.on('foo', listener);
e1.on('bar', listener);
e1.on('baz', listener);
e1.on('baz', listener);
var fooListeners = e1.listeners('foo');
var barListeners = e1.listeners('bar');
var bazListeners = e1.listeners('baz');
e1.on('removeListener', expect(['bar', 'baz', 'baz']));
e1.removeAllListeners('bar');
e1.removeAllListeners('baz');
assert.deepEqual(e1.listeners('foo'), [listener]);
assert.deepEqual(e1.listeners('bar'), []);
assert.deepEqual(e1.listeners('baz'), []);
assert.deepEqual(fooListeners, [listener]);
assert.deepEqual(barListeners, [listener]);
assert.deepEqual(bazListeners, [listener, listener]);
assert.notEqual(e1.listeners('bar'), barListeners);
assert.notEqual(e1.listeners('baz'), bazListeners);
var e2 = new events.EventEmitter();
e2.on('foo', listener);
e2.on('bar', listener);
e2.on('removeListener', expect(['foo', 'bar', 'removeListener']));
e2.on('removeListener', expect(['foo', 'bar']));
e2.removeAllListeners();
console.error(e2);
assert.deepEqual([], e2.listeners('foo'));
assert.deepEqual([], e2.listeners('bar'));
