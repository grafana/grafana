/* */ 
var assert = require('./assert');
var keys = Object.keys;
function makeBlock(f) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function() {
    return f.apply(this, args);
  };
}
test('assert.ok', function() {
  assert.throws(makeBlock(assert, false), assert.AssertionError, 'ok(false)');
  assert.doesNotThrow(makeBlock(assert, true), assert.AssertionError, 'ok(true)');
  assert.doesNotThrow(makeBlock(assert, 'test', 'ok(\'test\')'));
  assert.throws(makeBlock(assert.ok, false), assert.AssertionError, 'ok(false)');
  assert.doesNotThrow(makeBlock(assert.ok, true), assert.AssertionError, 'ok(true)');
  assert.doesNotThrow(makeBlock(assert.ok, 'test'), 'ok(\'test\')');
});
test('assert.equal', function() {
  assert.throws(makeBlock(assert.equal, true, false), assert.AssertionError, 'equal');
  assert.doesNotThrow(makeBlock(assert.equal, null, null), 'equal');
  assert.doesNotThrow(makeBlock(assert.equal, undefined, undefined), 'equal');
  assert.doesNotThrow(makeBlock(assert.equal, null, undefined), 'equal');
  assert.doesNotThrow(makeBlock(assert.equal, true, true), 'equal');
  assert.doesNotThrow(makeBlock(assert.equal, 2, '2'), 'equal');
  assert.doesNotThrow(makeBlock(assert.notEqual, true, false), 'notEqual');
  assert.throws(makeBlock(assert.notEqual, true, true), assert.AssertionError, 'notEqual');
});
test('assert.strictEqual', function() {
  assert.throws(makeBlock(assert.strictEqual, 2, '2'), assert.AssertionError, 'strictEqual');
  assert.throws(makeBlock(assert.strictEqual, null, undefined), assert.AssertionError, 'strictEqual');
  assert.doesNotThrow(makeBlock(assert.notStrictEqual, 2, '2'), 'notStrictEqual');
});
test('assert.deepEqual - 7.2', function() {
  assert.doesNotThrow(makeBlock(assert.deepEqual, new Date(2000, 3, 14), new Date(2000, 3, 14)), 'deepEqual date');
  assert.throws(makeBlock(assert.deepEqual, new Date(), new Date(2000, 3, 14)), assert.AssertionError, 'deepEqual date');
});
test('assert.deepEqual - 7.3', function() {
  assert.doesNotThrow(makeBlock(assert.deepEqual, /a/, /a/));
  assert.doesNotThrow(makeBlock(assert.deepEqual, /a/g, /a/g));
  assert.doesNotThrow(makeBlock(assert.deepEqual, /a/i, /a/i));
  assert.doesNotThrow(makeBlock(assert.deepEqual, /a/m, /a/m));
  assert.doesNotThrow(makeBlock(assert.deepEqual, /a/igm, /a/igm));
  assert.throws(makeBlock(assert.deepEqual, /ab/, /a/));
  assert.throws(makeBlock(assert.deepEqual, /a/g, /a/));
  assert.throws(makeBlock(assert.deepEqual, /a/i, /a/));
  assert.throws(makeBlock(assert.deepEqual, /a/m, /a/));
  assert.throws(makeBlock(assert.deepEqual, /a/igm, /a/im));
  var re1 = /a/;
  re1.lastIndex = 3;
  assert.throws(makeBlock(assert.deepEqual, re1, /a/));
});
test('assert.deepEqual - 7.4', function() {
  assert.doesNotThrow(makeBlock(assert.deepEqual, 4, '4'), 'deepEqual == check');
  assert.doesNotThrow(makeBlock(assert.deepEqual, true, 1), 'deepEqual == check');
  assert.throws(makeBlock(assert.deepEqual, 4, '5'), assert.AssertionError, 'deepEqual == check');
});
test('assert.deepEqual - 7.5', function() {
  assert.doesNotThrow(makeBlock(assert.deepEqual, {a: 4}, {a: 4}));
  assert.doesNotThrow(makeBlock(assert.deepEqual, {
    a: 4,
    b: '2'
  }, {
    a: 4,
    b: '2'
  }));
  assert.doesNotThrow(makeBlock(assert.deepEqual, [4], ['4']));
  assert.throws(makeBlock(assert.deepEqual, {a: 4}, {
    a: 4,
    b: true
  }), assert.AssertionError);
  assert.doesNotThrow(makeBlock(assert.deepEqual, ['a'], {0: 'a'}));
  assert.doesNotThrow(makeBlock(assert.deepEqual, {
    a: 4,
    b: '1'
  }, {
    b: '1',
    a: 4
  }));
  var a1 = [1, 2, 3];
  var a2 = [1, 2, 3];
  a1.a = 'test';
  a1.b = true;
  a2.b = true;
  a2.a = 'test';
  assert.throws(makeBlock(assert.deepEqual, keys(a1), keys(a2)), assert.AssertionError);
  assert.doesNotThrow(makeBlock(assert.deepEqual, a1, a2));
});
test('assert.deepEqual - instances', function() {
  var nbRoot = {toString: function() {
      return this.first + ' ' + this.last;
    }};
  function nameBuilder(first, last) {
    this.first = first;
    this.last = last;
    return this;
  }
  nameBuilder.prototype = nbRoot;
  function nameBuilder2(first, last) {
    this.first = first;
    this.last = last;
    return this;
  }
  nameBuilder2.prototype = nbRoot;
  var nb1 = new nameBuilder('Ryan', 'Dahl');
  var nb2 = new nameBuilder2('Ryan', 'Dahl');
  assert.doesNotThrow(makeBlock(assert.deepEqual, nb1, nb2));
  nameBuilder2.prototype = Object;
  nb2 = new nameBuilder2('Ryan', 'Dahl');
  assert.throws(makeBlock(assert.deepEqual, nb1, nb2), assert.AssertionError);
});
test('assert.deepEqual - ES6 primitives', function() {
  assert.throws(makeBlock(assert.deepEqual, null, {}), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, undefined, {}), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, 'a', ['a']), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, 'a', {0: 'a'}), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, 1, {}), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, true, {}), assert.AssertionError);
  if (typeof Symbol === 'symbol') {
    assert.throws(makeBlock(assert.deepEqual, Symbol(), {}), assert.AssertionError);
  }
});
test('assert.deepEqual - object wrappers', function() {
  assert.doesNotThrow(makeBlock(assert.deepEqual, new String('a'), ['a']));
  assert.doesNotThrow(makeBlock(assert.deepEqual, new String('a'), {0: 'a'}));
  assert.doesNotThrow(makeBlock(assert.deepEqual, new Number(1), {}));
  assert.doesNotThrow(makeBlock(assert.deepEqual, new Boolean(true), {}));
});
function thrower(errorConstructor) {
  throw new errorConstructor('test');
}
test('assert - Testing the throwing', function() {
  var aethrow = makeBlock(thrower, assert.AssertionError);
  aethrow = makeBlock(thrower, assert.AssertionError);
  assert.throws(makeBlock(thrower, assert.AssertionError), assert.AssertionError, 'message');
  assert.throws(makeBlock(thrower, assert.AssertionError), assert.AssertionError);
  assert.throws(makeBlock(thrower, assert.AssertionError));
  assert.throws(makeBlock(thrower, TypeError));
  var threw = false;
  try {
    assert.throws(makeBlock(thrower, TypeError), assert.AssertionError);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof TypeError, 'type');
  }
  assert.equal(true, threw, 'a.throws with an explicit error is eating extra errors', assert.AssertionError);
  threw = false;
  try {
    assert.doesNotThrow(makeBlock(thrower, TypeError), assert.AssertionError);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof TypeError);
  }
  assert.equal(true, threw, 'a.doesNotThrow with an explicit error is eating extra errors');
  try {
    assert.doesNotThrow(makeBlock(thrower, TypeError), TypeError);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof assert.AssertionError);
  }
  assert.equal(true, threw, 'a.doesNotThrow is not catching type matching errors');
});
test('assert.ifError', function() {
  assert.throws(function() {
    assert.ifError(new Error('test error'));
  });
  assert.doesNotThrow(function() {
    assert.ifError(null);
  });
  assert.doesNotThrow(function() {
    assert.ifError();
  });
});
test('assert - make sure that validating using constructor really works', function() {
  var threw = false;
  try {
    assert.throws(function() {
      throw ({});
    }, Array);
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'wrong constructor validation');
});
test('assert -  use a RegExp to validate error message', function() {
  assert.throws(makeBlock(thrower, TypeError), /test/);
});
test('assert - se a fn to validate error object', function() {
  assert.throws(makeBlock(thrower, TypeError), function(err) {
    if ((err instanceof TypeError) && /test/.test(err)) {
      return true;
    }
  });
});
test('assert - Make sure deepEqual doesn\'t loop forever on circular refs', function() {
  var b = {};
  b.b = b;
  var c = {};
  c.b = c;
  var gotError = false;
  try {
    assert.deepEqual(b, c);
  } catch (e) {
    gotError = true;
  }
  assert.ok(gotError);
});
test('assert - Ensure reflexivity of deepEqual with `arguments` objects', function() {
  var args = (function() {
    return arguments;
  })();
  assert.throws(makeBlock(assert.deepEqual, [], args), assert.AssertionError);
  assert.throws(makeBlock(assert.deepEqual, args, []), assert.AssertionError);
});
test('assert - test assertion message', function() {
  function testAssertionMessage(actual, expected) {
    try {
      assert.equal(actual, '');
    } catch (e) {
      assert.equal(e.toString(), ['AssertionError:', expected, '==', '""'].join(' '));
    }
  }
  testAssertionMessage(undefined, '"undefined"');
  testAssertionMessage(null, 'null');
  testAssertionMessage(true, 'true');
  testAssertionMessage(false, 'false');
  testAssertionMessage(0, '0');
  testAssertionMessage(100, '100');
  testAssertionMessage(NaN, '"NaN"');
  testAssertionMessage(Infinity, '"Infinity"');
  testAssertionMessage(-Infinity, '"-Infinity"');
  testAssertionMessage('', '""');
  testAssertionMessage('foo', '"foo"');
  testAssertionMessage([], '[]');
  testAssertionMessage([1, 2, 3], '[1,2,3]');
  testAssertionMessage(/a/, '"/a/"');
  testAssertionMessage(function f() {}, '"function f() {}"');
  testAssertionMessage({}, '{}');
  testAssertionMessage({
    a: undefined,
    b: null
  }, '{"a":"undefined","b":null}');
  testAssertionMessage({
    a: NaN,
    b: Infinity,
    c: -Infinity
  }, '{"a":"NaN","b":"Infinity","c":"-Infinity"}');
});
test('assert - regressions from node.js testcase', function() {
  var threw = false;
  try {
    assert.throws(function() {
      assert.ifError(null);
    });
  } catch (e) {
    threw = true;
    assert.equal(e.message, 'Missing expected exception..');
  }
  assert.ok(threw);
  try {
    assert.equal(1, 2);
  } catch (e) {
    assert.equal(e.toString().split('\n')[0], 'AssertionError: 1 == 2');
  }
  try {
    assert.equal(1, 2, 'oh no');
  } catch (e) {
    assert.equal(e.toString().split('\n')[0], 'AssertionError: oh no');
  }
});
