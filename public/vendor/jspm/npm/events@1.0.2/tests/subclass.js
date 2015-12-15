/* */ 
var assert = require('assert');
var EventEmitter = require('../events').EventEmitter;
var util = require('util');
util.inherits(MyEE, EventEmitter);
function MyEE(cb) {
  this.once(1, cb);
  this.emit(1);
  this.removeAllListeners();
  EventEmitter.call(this);
}
var called = false;
var myee = new MyEE(function() {
  called = true;
});
util.inherits(ErrorEE, EventEmitter);
function ErrorEE() {
  this.emit('error', new Error('blerg'));
}
assert.throws(function() {
  new ErrorEE();
}, /blerg/);
assert(called);
assert.deepEqual(myee._events, {});
