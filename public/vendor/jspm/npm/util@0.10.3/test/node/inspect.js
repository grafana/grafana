/* */ 
var assert = require('assert');
var util = require('../../util');
var Date2 = require('vm').runInNewContext('Date');
var d = new Date2();
var orig = util.inspect(d);
Date2.prototype.foo = 'bar';
var after = util.inspect(d);
assert.equal(orig, after);
var a = ['foo', 'bar', 'baz'];
assert.equal(util.inspect(a), '[ \'foo\', \'bar\', \'baz\' ]');
delete a[1];
assert.equal(util.inspect(a), '[ \'foo\', , \'baz\' ]');
assert.equal(util.inspect(a, true), '[ \'foo\', , \'baz\', [length]: 3 ]');
assert.equal(util.inspect(new Array(5)), '[ , , , ,  ]');
var getter = Object.create(null, {a: {get: function() {
      return 'aaa';
    }}});
var setter = Object.create(null, {b: {set: function() {}}});
var getterAndSetter = Object.create(null, {c: {
    get: function() {
      return 'ccc';
    },
    set: function() {}
  }});
assert.equal(util.inspect(getter, true), '{ [a]: [Getter] }');
assert.equal(util.inspect(setter, true), '{ [b]: [Setter] }');
assert.equal(util.inspect(getterAndSetter, true), '{ [c]: [Getter/Setter] }');
assert.equal(util.inspect(new Error()), '[Error]');
assert.equal(util.inspect(new Error('FAIL')), '[Error: FAIL]');
assert.equal(util.inspect(new TypeError('FAIL')), '[TypeError: FAIL]');
assert.equal(util.inspect(new SyntaxError('FAIL')), '[SyntaxError: FAIL]');
try {
  undef();
} catch (e) {
  assert.equal(util.inspect(e), '[ReferenceError: undef is not defined]');
}
var ex = util.inspect(new Error('FAIL'), true);
assert.ok(ex.indexOf('[Error: FAIL]') != -1);
assert.ok(ex.indexOf('[stack]') != -1);
assert.ok(ex.indexOf('[message]') != -1);
assert.equal(util.inspect(Object.create(Date.prototype)), '{}');
assert.doesNotThrow(function() {
  var d = new Date();
  d.toUTCString = null;
  util.inspect(d);
});
assert.doesNotThrow(function() {
  var r = /regexp/;
  r.toString = null;
  util.inspect(r);
});
assert.doesNotThrow(function() {
  util.inspect([{inspect: function() {
      return 123;
    }}]);
});
var x = {inspect: util.inspect};
assert.ok(util.inspect(x).indexOf('inspect') != -1);
function test_color_style(style, input, implicit) {
  var color_name = util.inspect.styles[style];
  var color = ['', ''];
  if (util.inspect.colors[color_name])
    color = util.inspect.colors[color_name];
  var without_color = util.inspect(input, false, 0, false);
  var with_color = util.inspect(input, false, 0, true);
  var expect = '\u001b[' + color[0] + 'm' + without_color + '\u001b[' + color[1] + 'm';
  assert.equal(with_color, expect, 'util.inspect color for style ' + style);
}
test_color_style('special', function() {});
test_color_style('number', 123.456);
test_color_style('boolean', true);
test_color_style('undefined', undefined);
test_color_style('null', null);
test_color_style('string', 'test string');
test_color_style('date', new Date);
test_color_style('regexp', /regexp/);
assert.doesNotThrow(function() {
  util.inspect({hasOwnProperty: null});
});
var subject = {
  foo: 'bar',
  hello: 31,
  a: {b: {c: {d: 0}}}
};
Object.defineProperty(subject, 'hidden', {
  enumerable: false,
  value: null
});
assert(util.inspect(subject, {showHidden: false}).indexOf('hidden') === -1);
assert(util.inspect(subject, {showHidden: true}).indexOf('hidden') !== -1);
assert(util.inspect(subject, {colors: false}).indexOf('\u001b[32m') === -1);
assert(util.inspect(subject, {colors: true}).indexOf('\u001b[32m') !== -1);
assert(util.inspect(subject, {depth: 2}).indexOf('c: [Object]') !== -1);
assert(util.inspect(subject, {depth: 0}).indexOf('a: [Object]') !== -1);
assert(util.inspect(subject, {depth: null}).indexOf('{ d: 0 }') !== -1);
subject = {inspect: function() {
    return 123;
  }};
assert(util.inspect(subject, {customInspect: true}).indexOf('123') !== -1);
assert(util.inspect(subject, {customInspect: true}).indexOf('inspect') === -1);
assert(util.inspect(subject, {customInspect: false}).indexOf('123') === -1);
assert(util.inspect(subject, {customInspect: false}).indexOf('inspect') !== -1);
subject.inspect = function() {
  return {foo: 'bar'};
};
assert.equal(util.inspect(subject), '{ foo: \'bar\' }');
subject.inspect = function(depth, opts) {
  assert.strictEqual(opts.customInspectOptions, true);
};
util.inspect(subject, {customInspectOptions: true});
function test_lines(input) {
  var count_lines = function(str) {
    return (str.match(/\n/g) || []).length;
  };
  var without_color = util.inspect(input);
  var with_color = util.inspect(input, {colors: true});
  assert.equal(count_lines(without_color), count_lines(with_color));
}
test_lines([1, 2, 3, 4, 5, 6, 7]);
test_lines(function() {
  var big_array = [];
  for (var i = 0; i < 100; i++) {
    big_array.push(i);
  }
  return big_array;
}());
test_lines({
  foo: 'bar',
  baz: 35,
  b: {a: 35}
});
test_lines({
  foo: 'bar',
  baz: 35,
  b: {a: 35},
  very_long_key: 'very_long_value',
  even_longer_key: ['with even longer value in array']
});
