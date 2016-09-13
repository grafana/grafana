(function() {
  var _ = typeof require == 'function' ? require('..') : window._;

  QUnit.module('Chaining');

  QUnit.test('map/flatten/reduce', function(assert) {
    var lyrics = [
      'I\'m a lumberjack and I\'m okay',
      'I sleep all night and I work all day',
      'He\'s a lumberjack and he\'s okay',
      'He sleeps all night and he works all day'
    ];
    var counts = _(lyrics).chain()
      .map(function(line) { return line.split(''); })
      .flatten()
      .reduce(function(hash, l) {
        hash[l] = hash[l] || 0;
        hash[l]++;
        return hash;
      }, {})
      .value();
    assert.equal(counts.a, 16, 'counted all the letters in the song');
    assert.equal(counts.e, 10, 'counted all the letters in the song');
  });

  QUnit.test('select/reject/sortBy', function(assert) {
    var numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    numbers = _(numbers).chain().select(function(n) {
      return n % 2 === 0;
    }).reject(function(n) {
      return n % 4 === 0;
    }).sortBy(function(n) {
      return -n;
    }).value();
    assert.deepEqual(numbers, [10, 6, 2], 'filtered and reversed the numbers');
  });

  QUnit.test('select/reject/sortBy in functional style', function(assert) {
    var numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    numbers = _.chain(numbers).select(function(n) {
      return n % 2 === 0;
    }).reject(function(n) {
      return n % 4 === 0;
    }).sortBy(function(n) {
      return -n;
    }).value();
    assert.deepEqual(numbers, [10, 6, 2], 'filtered and reversed the numbers');
  });

  QUnit.test('reverse/concat/unshift/pop/map', function(assert) {
    var numbers = [1, 2, 3, 4, 5];
    numbers = _(numbers).chain()
      .reverse()
      .concat([5, 5, 5])
      .unshift(17)
      .pop()
      .map(function(n){ return n * 2; })
      .value();
    assert.deepEqual(numbers, [34, 10, 8, 6, 4, 2, 10, 10], 'can chain together array functions.');
  });

  QUnit.test('splice', function(assert) {
    var instance = _([1, 2, 3, 4, 5]).chain();
    assert.deepEqual(instance.splice(1, 3).value(), [1, 5]);
    assert.deepEqual(instance.splice(1, 0).value(), [1, 5]);
    assert.deepEqual(instance.splice(1, 1).value(), [1]);
    assert.deepEqual(instance.splice(0, 1).value(), [], '#397 Can create empty array');
  });

  QUnit.test('shift', function(assert) {
    var instance = _([1, 2, 3]).chain();
    assert.deepEqual(instance.shift().value(), [2, 3]);
    assert.deepEqual(instance.shift().value(), [3]);
    assert.deepEqual(instance.shift().value(), [], '#397 Can create empty array');
  });

  QUnit.test('pop', function(assert) {
    var instance = _([1, 2, 3]).chain();
    assert.deepEqual(instance.pop().value(), [1, 2]);
    assert.deepEqual(instance.pop().value(), [1]);
    assert.deepEqual(instance.pop().value(), [], '#397 Can create empty array');
  });

  QUnit.test('chaining works in small stages', function(assert) {
    var o = _([1, 2, 3, 4]).chain();
    assert.deepEqual(o.filter(function(i) { return i < 3; }).value(), [1, 2]);
    assert.deepEqual(o.filter(function(i) { return i > 2; }).value(), [3, 4]);
  });

  QUnit.test('#1562: Engine proxies for chained functions', function(assert) {
    var wrapped = _(512);
    assert.strictEqual(wrapped.toJSON(), 512);
    assert.strictEqual(wrapped.valueOf(), 512);
    assert.strictEqual(+wrapped, 512);
    assert.strictEqual(wrapped.toString(), '512');
    assert.strictEqual('' + wrapped, '512');
  });

}());
