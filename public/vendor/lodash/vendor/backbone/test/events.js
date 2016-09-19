(function(QUnit) {

  QUnit.module('Backbone.Events');

  QUnit.test('on and trigger', function(assert) {
    assert.expect(2);
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);
    obj.on('event', function() { obj.counter += 1; });
    obj.trigger('event');
    assert.equal(obj.counter, 1, 'counter should be incremented.');
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    assert.equal(obj.counter, 5, 'counter should be incremented five times.');
  });

  QUnit.test('binding and triggering multiple events', function(assert) {
    assert.expect(4);
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);

    obj.on('a b c', function() { obj.counter += 1; });

    obj.trigger('a');
    assert.equal(obj.counter, 1);

    obj.trigger('a b');
    assert.equal(obj.counter, 3);

    obj.trigger('c');
    assert.equal(obj.counter, 4);

    obj.off('a c');
    obj.trigger('a b c');
    assert.equal(obj.counter, 5);
  });

  QUnit.test('binding and triggering with event maps', function(assert) {
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);

    var increment = function() {
      this.counter += 1;
    };

    obj.on({
      a: increment,
      b: increment,
      c: increment
    }, obj);

    obj.trigger('a');
    assert.equal(obj.counter, 1);

    obj.trigger('a b');
    assert.equal(obj.counter, 3);

    obj.trigger('c');
    assert.equal(obj.counter, 4);

    obj.off({
      a: increment,
      c: increment
    }, obj);
    obj.trigger('a b c');
    assert.equal(obj.counter, 5);
  });

  QUnit.test('binding and triggering multiple event names with event maps', function(assert) {
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);

    var increment = function() {
      this.counter += 1;
    };

    obj.on({
      'a b c': increment
    });

    obj.trigger('a');
    assert.equal(obj.counter, 1);

    obj.trigger('a b');
    assert.equal(obj.counter, 3);

    obj.trigger('c');
    assert.equal(obj.counter, 4);

    obj.off({
      'a c': increment
    });
    obj.trigger('a b c');
    assert.equal(obj.counter, 5);
  });

  QUnit.test('binding and trigger with event maps context', function(assert) {
    assert.expect(2);
    var obj = {counter: 0};
    var context = {};
    _.extend(obj, Backbone.Events);

    obj.on({
      a: function() {
        assert.strictEqual(this, context, 'defaults `context` to `callback` param');
      }
    }, context).trigger('a');

    obj.off().on({
      a: function() {
        assert.strictEqual(this, context, 'will not override explicit `context` param');
      }
    }, this, context).trigger('a');
  });

  QUnit.test('listenTo and stopListening', function(assert) {
    assert.expect(1);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenTo(b, 'all', function(){ assert.ok(true); });
    b.trigger('anything');
    a.listenTo(b, 'all', function(){ assert.ok(false); });
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo and stopListening with event maps', function(assert) {
    assert.expect(4);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    var cb = function(){ assert.ok(true); };
    a.listenTo(b, {event: cb});
    b.trigger('event');
    a.listenTo(b, {event2: cb});
    b.on('event2', cb);
    a.stopListening(b, {event2: cb});
    b.trigger('event event2');
    a.stopListening();
    b.trigger('event event2');
  });

  QUnit.test('stopListening with omitted args', function(assert) {
    assert.expect(2);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    var cb = function() { assert.ok(true); };
    a.listenTo(b, 'event', cb);
    b.on('event', cb);
    a.listenTo(b, 'event2', cb);
    a.stopListening(null, {event: cb});
    b.trigger('event event2');
    b.off();
    a.listenTo(b, 'event event2', cb);
    a.stopListening(null, 'event');
    a.stopListening();
    b.trigger('event2');
  });

  QUnit.test('listenToOnce', function(assert) {
    assert.expect(2);
    // Same as the previous test, but we use once rather than having to explicitly unbind
    var obj = {counterA: 0, counterB: 0};
    _.extend(obj, Backbone.Events);
    var incrA = function(){ obj.counterA += 1; obj.trigger('event'); };
    var incrB = function(){ obj.counterB += 1; };
    obj.listenToOnce(obj, 'event', incrA);
    obj.listenToOnce(obj, 'event', incrB);
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('listenToOnce and stopListening', function(assert) {
    assert.expect(1);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenToOnce(b, 'all', function() { assert.ok(true); });
    b.trigger('anything');
    b.trigger('anything');
    a.listenToOnce(b, 'all', function() { assert.ok(false); });
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo, listenToOnce and stopListening', function(assert) {
    assert.expect(1);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenToOnce(b, 'all', function() { assert.ok(true); });
    b.trigger('anything');
    b.trigger('anything');
    a.listenTo(b, 'all', function() { assert.ok(false); });
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo and stopListening with event maps', function(assert) {
    assert.expect(1);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenTo(b, {change: function(){ assert.ok(true); }});
    b.trigger('change');
    a.listenTo(b, {change: function(){ assert.ok(false); }});
    a.stopListening();
    b.trigger('change');
  });

  QUnit.test('listenTo yourself', function(assert) {
    assert.expect(1);
    var e = _.extend({}, Backbone.Events);
    e.listenTo(e, 'foo', function(){ assert.ok(true); });
    e.trigger('foo');
  });

  QUnit.test('listenTo yourself cleans yourself up with stopListening', function(assert) {
    assert.expect(1);
    var e = _.extend({}, Backbone.Events);
    e.listenTo(e, 'foo', function(){ assert.ok(true); });
    e.trigger('foo');
    e.stopListening();
    e.trigger('foo');
  });

  QUnit.test('stopListening cleans up references', function(assert) {
    assert.expect(12);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    var fn = function() {};
    b.on('event', fn);
    a.listenTo(b, 'event', fn).stopListening();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b, 'event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b, 'event', fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('stopListening cleans up references from listenToOnce', function(assert) {
    assert.expect(12);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    var fn = function() {};
    b.on('event', fn);
    a.listenToOnce(b, 'event', fn).stopListening();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b, 'event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b, 'event', fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('listenTo and off cleaning up references', function(assert) {
    assert.expect(8);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    var fn = function() {};
    a.listenTo(b, 'event', fn);
    b.off();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off('event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off(null, fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off(null, null, a);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('listenTo and stopListening cleaning up references', function(assert) {
    assert.expect(2);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenTo(b, 'all', function(){ assert.ok(true); });
    b.trigger('anything');
    a.listenTo(b, 'other', function(){ assert.ok(false); });
    a.stopListening(b, 'other');
    a.stopListening(b, 'all');
    assert.equal(_.size(a._listeningTo), 0);
  });

  QUnit.test('listenToOnce without context cleans up references after the event has fired', function(assert) {
    assert.expect(2);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenToOnce(b, 'all', function(){ assert.ok(true); });
    b.trigger('anything');
    assert.equal(_.size(a._listeningTo), 0);
  });

  QUnit.test('listenToOnce with event maps cleans up references', function(assert) {
    assert.expect(2);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenToOnce(b, {
      one: function() { assert.ok(true); },
      two: function() { assert.ok(false); }
    });
    b.trigger('one');
    assert.equal(_.size(a._listeningTo), 1);
  });

  QUnit.test('listenToOnce with event maps binds the correct `this`', function(assert) {
    assert.expect(1);
    var a = _.extend({}, Backbone.Events);
    var b = _.extend({}, Backbone.Events);
    a.listenToOnce(b, {
      one: function() { assert.ok(this === a); },
      two: function() { assert.ok(false); }
    });
    b.trigger('one');
  });

  QUnit.test("listenTo with empty callback doesn't throw an error", function(assert) {
    assert.expect(1);
    var e = _.extend({}, Backbone.Events);
    e.listenTo(e, 'foo', null);
    e.trigger('foo');
    assert.ok(true);
  });

  QUnit.test('trigger all for each event', function(assert) {
    assert.expect(3);
    var a, b, obj = {counter: 0};
    _.extend(obj, Backbone.Events);
    obj.on('all', function(event) {
      obj.counter++;
      if (event === 'a') a = true;
      if (event === 'b') b = true;
    })
    .trigger('a b');
    assert.ok(a);
    assert.ok(b);
    assert.equal(obj.counter, 2);
  });

  QUnit.test('on, then unbind all functions', function(assert) {
    assert.expect(1);
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);
    var callback = function() { obj.counter += 1; };
    obj.on('event', callback);
    obj.trigger('event');
    obj.off('event');
    obj.trigger('event');
    assert.equal(obj.counter, 1, 'counter should have only been incremented once.');
  });

  QUnit.test('bind two callbacks, unbind only one', function(assert) {
    assert.expect(2);
    var obj = {counterA: 0, counterB: 0};
    _.extend(obj, Backbone.Events);
    var callback = function() { obj.counterA += 1; };
    obj.on('event', callback);
    obj.on('event', function() { obj.counterB += 1; });
    obj.trigger('event');
    obj.off('event', callback);
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 2, 'counterB should have been incremented twice.');
  });

  QUnit.test('unbind a callback in the midst of it firing', function(assert) {
    assert.expect(1);
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);
    var callback = function() {
      obj.counter += 1;
      obj.off('event', callback);
    };
    obj.on('event', callback);
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    assert.equal(obj.counter, 1, 'the callback should have been unbound.');
  });

  QUnit.test('two binds that unbind themeselves', function(assert) {
    assert.expect(2);
    var obj = {counterA: 0, counterB: 0};
    _.extend(obj, Backbone.Events);
    var incrA = function(){ obj.counterA += 1; obj.off('event', incrA); };
    var incrB = function(){ obj.counterB += 1; obj.off('event', incrB); };
    obj.on('event', incrA);
    obj.on('event', incrB);
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('bind a callback with a default context when none supplied', function(assert) {
    assert.expect(1);
    var obj = _.extend({
      assertTrue: function() {
        assert.equal(this, obj, '`this` was bound to the callback');
      }
    }, Backbone.Events);

    obj.once('event', obj.assertTrue);
    obj.trigger('event');
  });

  QUnit.test('bind a callback with a supplied context', function(assert) {
    assert.expect(1);
    var TestClass = function() {
      return this;
    };
    TestClass.prototype.assertTrue = function() {
      assert.ok(true, '`this` was bound to the callback');
    };

    var obj = _.extend({}, Backbone.Events);
    obj.on('event', function() { this.assertTrue(); }, new TestClass);
    obj.trigger('event');
  });

  QUnit.test('nested trigger with unbind', function(assert) {
    assert.expect(1);
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);
    var incr1 = function(){ obj.counter += 1; obj.off('event', incr1); obj.trigger('event'); };
    var incr2 = function(){ obj.counter += 1; };
    obj.on('event', incr1);
    obj.on('event', incr2);
    obj.trigger('event');
    assert.equal(obj.counter, 3, 'counter should have been incremented three times');
  });

  QUnit.test('callback list is not altered during trigger', function(assert) {
    assert.expect(2);
    var counter = 0, obj = _.extend({}, Backbone.Events);
    var incr = function(){ counter++; };
    var incrOn = function(){ obj.on('event all', incr); };
    var incrOff = function(){ obj.off('event all', incr); };

    obj.on('event all', incrOn).trigger('event');
    assert.equal(counter, 0, 'on does not alter callback list');

    obj.off().on('event', incrOff).on('event all', incr).trigger('event');
    assert.equal(counter, 2, 'off does not alter callback list');
  });

  QUnit.test("#1282 - 'all' callback list is retrieved after each event.", function(assert) {
    assert.expect(1);
    var counter = 0;
    var obj = _.extend({}, Backbone.Events);
    var incr = function(){ counter++; };
    obj.on('x', function() {
      obj.on('y', incr).on('all', incr);
    })
    .trigger('x y');
    assert.strictEqual(counter, 2);
  });

  QUnit.test('if no callback is provided, `on` is a noop', function(assert) {
    assert.expect(0);
    _.extend({}, Backbone.Events).on('test').trigger('test');
  });

  QUnit.test('if callback is truthy but not a function, `on` should throw an error just like jQuery', function(assert) {
    assert.expect(1);
    var view = _.extend({}, Backbone.Events).on('test', 'noop');
    assert.raises(function() {
      view.trigger('test');
    });
  });

  QUnit.test('remove all events for a specific context', function(assert) {
    assert.expect(4);
    var obj = _.extend({}, Backbone.Events);
    obj.on('x y all', function() { assert.ok(true); });
    obj.on('x y all', function() { assert.ok(false); }, obj);
    obj.off(null, null, obj);
    obj.trigger('x y');
  });

  QUnit.test('remove all events for a specific callback', function(assert) {
    assert.expect(4);
    var obj = _.extend({}, Backbone.Events);
    var success = function() { assert.ok(true); };
    var fail = function() { assert.ok(false); };
    obj.on('x y all', success);
    obj.on('x y all', fail);
    obj.off(null, fail);
    obj.trigger('x y');
  });

  QUnit.test('#1310 - off does not skip consecutive events', function(assert) {
    assert.expect(0);
    var obj = _.extend({}, Backbone.Events);
    obj.on('event', function() { assert.ok(false); }, obj);
    obj.on('event', function() { assert.ok(false); }, obj);
    obj.off(null, null, obj);
    obj.trigger('event');
  });

  QUnit.test('once', function(assert) {
    assert.expect(2);
    // Same as the previous test, but we use once rather than having to explicitly unbind
    var obj = {counterA: 0, counterB: 0};
    _.extend(obj, Backbone.Events);
    var incrA = function(){ obj.counterA += 1; obj.trigger('event'); };
    var incrB = function(){ obj.counterB += 1; };
    obj.once('event', incrA);
    obj.once('event', incrB);
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('once variant one', function(assert) {
    assert.expect(3);
    var f = function(){ assert.ok(true); };

    var a = _.extend({}, Backbone.Events).once('event', f);
    var b = _.extend({}, Backbone.Events).on('event', f);

    a.trigger('event');

    b.trigger('event');
    b.trigger('event');
  });

  QUnit.test('once variant two', function(assert) {
    assert.expect(3);
    var f = function(){ assert.ok(true); };
    var obj = _.extend({}, Backbone.Events);

    obj
      .once('event', f)
      .on('event', f)
      .trigger('event')
      .trigger('event');
  });

  QUnit.test('once with off', function(assert) {
    assert.expect(0);
    var f = function(){ assert.ok(true); };
    var obj = _.extend({}, Backbone.Events);

    obj.once('event', f);
    obj.off('event', f);
    obj.trigger('event');
  });

  QUnit.test('once with event maps', function(assert) {
    var obj = {counter: 0};
    _.extend(obj, Backbone.Events);

    var increment = function() {
      this.counter += 1;
    };

    obj.once({
      a: increment,
      b: increment,
      c: increment
    }, obj);

    obj.trigger('a');
    assert.equal(obj.counter, 1);

    obj.trigger('a b');
    assert.equal(obj.counter, 2);

    obj.trigger('c');
    assert.equal(obj.counter, 3);

    obj.trigger('a b c');
    assert.equal(obj.counter, 3);
  });

  QUnit.test('bind a callback with a supplied context using once with object notation', function(assert) {
    assert.expect(1);
    var obj = {counter: 0};
    var context = {};
    _.extend(obj, Backbone.Events);

    obj.once({
      a: function() {
        assert.strictEqual(this, context, 'defaults `context` to `callback` param');
      }
    }, context).trigger('a');
  });

  QUnit.test('once with off only by context', function(assert) {
    assert.expect(0);
    var context = {};
    var obj = _.extend({}, Backbone.Events);
    obj.once('event', function(){ assert.ok(false); }, context);
    obj.off(null, null, context);
    obj.trigger('event');
  });

  QUnit.test('Backbone object inherits Events', function(assert) {
    assert.ok(Backbone.on === Backbone.Events.on);
  });

  QUnit.test('once with asynchronous events', function(assert) {
    var done = assert.async();
    assert.expect(1);
    var func = _.debounce(function() { assert.ok(true); done(); }, 50);
    var obj = _.extend({}, Backbone.Events).once('async', func);

    obj.trigger('async');
    obj.trigger('async');
  });

  QUnit.test('once with multiple events.', function(assert) {
    assert.expect(2);
    var obj = _.extend({}, Backbone.Events);
    obj.once('x y', function() { assert.ok(true); });
    obj.trigger('x y');
  });

  QUnit.test('Off during iteration with once.', function(assert) {
    assert.expect(2);
    var obj = _.extend({}, Backbone.Events);
    var f = function(){ this.off('event', f); };
    obj.on('event', f);
    obj.once('event', function(){});
    obj.on('event', function(){ assert.ok(true); });

    obj.trigger('event');
    obj.trigger('event');
  });

  QUnit.test('`once` on `all` should work as expected', function(assert) {
    assert.expect(1);
    Backbone.once('all', function() {
      assert.ok(true);
      Backbone.trigger('all');
    });
    Backbone.trigger('all');
  });

  QUnit.test('once without a callback is a noop', function(assert) {
    assert.expect(0);
    _.extend({}, Backbone.Events).once('event').trigger('event');
  });

  QUnit.test('listenToOnce without a callback is a noop', function(assert) {
    assert.expect(0);
    var obj = _.extend({}, Backbone.Events);
    obj.listenToOnce(obj, 'event').trigger('event');
  });

  QUnit.test('event functions are chainable', function(assert) {
    var obj = _.extend({}, Backbone.Events);
    var obj2 = _.extend({}, Backbone.Events);
    var fn = function() {};
    assert.equal(obj, obj.trigger('noeventssetyet'));
    assert.equal(obj, obj.off('noeventssetyet'));
    assert.equal(obj, obj.stopListening('noeventssetyet'));
    assert.equal(obj, obj.on('a', fn));
    assert.equal(obj, obj.once('c', fn));
    assert.equal(obj, obj.trigger('a'));
    assert.equal(obj, obj.listenTo(obj2, 'a', fn));
    assert.equal(obj, obj.listenToOnce(obj2, 'b', fn));
    assert.equal(obj, obj.off('a c'));
    assert.equal(obj, obj.stopListening(obj2, 'a'));
    assert.equal(obj, obj.stopListening());
  });

  QUnit.test('#3448 - listenToOnce with space-separated events', function(assert) {
    assert.expect(2);
    var one = _.extend({}, Backbone.Events);
    var two = _.extend({}, Backbone.Events);
    var count = 1;
    one.listenToOnce(two, 'x y', function(n) { assert.ok(n === count++); });
    two.trigger('x', 1);
    two.trigger('x', 1);
    two.trigger('y', 2);
    two.trigger('y', 2);
  });

})(QUnit);
