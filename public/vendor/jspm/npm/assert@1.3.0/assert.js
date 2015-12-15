/* */ 
var util = require('util');
var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;
var assert = module.exports = ok;
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    var err = new Error();
    if (err.stack) {
      var out = err.stack;
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }
      this.stack = out;
    }
  }
};
util.inherits(assert.AssertionError, Error);
function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}
function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' + self.operator + ' ' + truncate(JSON.stringify(self.expected, replacer), 128);
}
function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}
assert.fail = fail;
function ok(value, message) {
  if (!value)
    fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;
assert.equal = function equal(actual, expected, message) {
  if (actual != expected)
    fail(actual, expected, message, '==', assert.equal);
};
assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};
assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};
function _deepEqual(actual, expected) {
  if (actual === expected) {
    return true;
  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length)
      return false;
    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i])
        return false;
    }
    return true;
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase;
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;
  } else {
    return objEquiv(actual, expected);
  }
}
function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}
function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  if (a.prototype !== b.prototype)
    return false;
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key,
      i;
  if (ka.length != kb.length)
    return false;
  ka.sort();
  kb.sort();
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key]))
      return false;
  }
  return true;
}
assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};
assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};
assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};
function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }
  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }
  return false;
}
function _throws(shouldThrow, block, expected, message) {
  var actual;
  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }
  try {
    block();
  } catch (e) {
    actual = e;
  }
  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') + (message ? ' ' + message : '.');
  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }
  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }
  if ((shouldThrow && actual && expected && !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}
assert.throws = function(block, error, message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};
assert.doesNotThrow = function(block, message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};
assert.ifError = function(err) {
  if (err) {
    throw err;
  }
};
var objectKeys = Object.keys || function(obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key))
      keys.push(key);
  }
  return keys;
};
