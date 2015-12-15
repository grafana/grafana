/* */ 
var assert = require('assert');
var util = require('../../util');
suite('inspect');
test('util.inspect - test for sparse array', function() {
  var a = ['foo', 'bar', 'baz'];
  assert.equal(util.inspect(a), '[ \'foo\', \'bar\', \'baz\' ]');
  delete a[1];
  assert.equal(util.inspect(a), '[ \'foo\', , \'baz\' ]');
  assert.equal(util.inspect(a, true), '[ \'foo\', , \'baz\', [length]: 3 ]');
  assert.equal(util.inspect(new Array(5)), '[ , , , ,  ]');
});
test('util.inspect -  exceptions should print the error message, not \'{}\'', function() {
  assert.equal(util.inspect(new Error()), '[Error]');
  assert.equal(util.inspect(new Error('FAIL')), '[Error: FAIL]');
  assert.equal(util.inspect(new TypeError('FAIL')), '[TypeError: FAIL]');
  assert.equal(util.inspect(new SyntaxError('FAIL')), '[SyntaxError: FAIL]');
});
