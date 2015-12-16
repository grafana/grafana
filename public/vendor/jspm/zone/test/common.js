
// Enable zones
require('../').enable();

// Export a global 'isv010' that is true when running on node v0.10.x, or false
// otherwise.
global.isv010 = require('../lib/isv010.js');

// Create a global 'test' that has all assert methods on it, wrapped
// such that the number of assertions is counted.
// In addition, the test can use test.expect() to set the number of expected
// assertions, and should call test.done() to signal that the test completed
// successfully.

var assert = require('assert');

var test = global.test = {};

var expected = null;
var seen = 0;
var done = false;

test.expect = function(n) {
  if (expected !== null)
    throw new Error('number of expected assertions already set');

  expected = n;
};

test.done = function() {
  if (done)
    throw new Error('test already done');

  if (expected !== null &&
      expected !== seen)
    throw new Error('Too few or too many assertions.\n' +
                     expected + ' assertions expected but ' + seen + ' seen.');

  done = true;
};

process.on('exit', function() {
  if (!done)
    throw new Error('Test not done');
});

function wrapAssert(fn) {
  return function() {
    seen++;
    return fn.apply(assert, arguments);
  }
}

for (var key in assert) {
  if (assert.hasOwnProperty(key))
    test[key] = wrapAssert(assert[key]);
}
