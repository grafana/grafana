/* */ 
(function(process) {
  var assert = require('assert');
  var events = require('../events');
  var e = new events.EventEmitter();
  for (var i = 0; i < 10; i++) {
    e.on('default', function() {});
  }
  assert.ok(!e._events['default'].hasOwnProperty('warned'));
  e.on('default', function() {});
  assert.ok(e._events['default'].warned);
  e.setMaxListeners(5);
  for (var i = 0; i < 5; i++) {
    e.on('specific', function() {});
  }
  assert.ok(!e._events['specific'].hasOwnProperty('warned'));
  e.on('specific', function() {});
  assert.ok(e._events['specific'].warned);
  e.setMaxListeners(1);
  e.on('only one', function() {});
  assert.ok(!e._events['only one'].hasOwnProperty('warned'));
  e.on('only one', function() {});
  assert.ok(e._events['only one'].hasOwnProperty('warned'));
  e.setMaxListeners(0);
  for (var i = 0; i < 1000; i++) {
    e.on('unlimited', function() {});
  }
  assert.ok(!e._events['unlimited'].hasOwnProperty('warned'));
  events.EventEmitter.defaultMaxListeners = 42;
  e = new events.EventEmitter();
  for (var i = 0; i < 42; ++i) {
    e.on('fortytwo', function() {});
  }
  assert.ok(!e._events['fortytwo'].hasOwnProperty('warned'));
  e.on('fortytwo', function() {});
  assert.ok(e._events['fortytwo'].hasOwnProperty('warned'));
  delete e._events['fortytwo'].warned;
  events.EventEmitter.defaultMaxListeners = 44;
  e.on('fortytwo', function() {});
  assert.ok(!e._events['fortytwo'].hasOwnProperty('warned'));
  e.on('fortytwo', function() {});
  assert.ok(e._events['fortytwo'].hasOwnProperty('warned'));
  events.EventEmitter.defaultMaxListeners = 42;
  e = new events.EventEmitter();
  e.setMaxListeners(1);
  e.on('uno', function() {});
  assert.ok(!e._events['uno'].hasOwnProperty('warned'));
  e.on('uno', function() {});
  assert.ok(e._events['uno'].hasOwnProperty('warned'));
  assert.strictEqual(e, e.setMaxListeners(1));
})(require('process'));
