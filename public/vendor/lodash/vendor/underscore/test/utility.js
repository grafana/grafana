(function() {
  var _ = typeof require == 'function' ? require('..') : window._;
  var templateSettings;

  QUnit.module('Utility', {

    beforeEach: function() {
      templateSettings = _.clone(_.templateSettings);
    },

    afterEach: function() {
      _.templateSettings = templateSettings;
    }

  });

  if (typeof this == 'object') {
    QUnit.test('noConflict', function(assert) {
      var underscore = _.noConflict();
      assert.equal(underscore.identity(1), 1);
      if (typeof require != 'function') {
        assert.equal(this._, void 0, 'global underscore is removed');
        this._ = underscore;
      } else if (typeof global !== 'undefined') {
        delete global._;
      }
    });
  }

  if (typeof require == 'function') {
    QUnit.test('noConflict (node vm)', function(assert) {
      assert.expect(2);
      var done = assert.async();
      var fs = require('fs');
      var vm = require('vm');
      var filename = __dirname + '/../underscore.js';
      fs.readFile(filename, function(err, content){
        var sandbox = vm.createScript(
          content + 'this.underscore = this._.noConflict();',
          filename
        );
        var context = {_: 'oldvalue'};
        sandbox.runInNewContext(context);
        assert.equal(context._, 'oldvalue');
        assert.equal(context.underscore.VERSION, _.VERSION);

        done();
      });
    });
  }

  QUnit.test('#750 - Return _ instance.', function(assert) {
    assert.expect(2);
    var instance = _([]);
    assert.strictEqual(_(instance), instance);
    assert.strictEqual(new _(instance), instance);
  });

  QUnit.test('identity', function(assert) {
    var stooge = {name: 'moe'};
    assert.equal(_.identity(stooge), stooge, 'stooge is the same as his identity');
  });

  QUnit.test('constant', function(assert) {
    var stooge = {name: 'moe'};
    assert.equal(_.constant(stooge)(), stooge, 'should create a function that returns stooge');
  });

  QUnit.test('noop', function(assert) {
    assert.strictEqual(_.noop('curly', 'larry', 'moe'), void 0, 'should always return undefined');
  });

  QUnit.test('property', function(assert) {
    var stooge = {name: 'moe'};
    assert.equal(_.property('name')(stooge), 'moe', 'should return the property with the given name');
    assert.equal(_.property('name')(null), void 0, 'should return undefined for null values');
    assert.equal(_.property('name')(void 0), void 0, 'should return undefined for undefined values');
  });

  QUnit.test('propertyOf', function(assert) {
    var stoogeRanks = _.propertyOf({curly: 2, moe: 1, larry: 3});
    assert.equal(stoogeRanks('curly'), 2, 'should return the property with the given name');
    assert.equal(stoogeRanks(null), void 0, 'should return undefined for null values');
    assert.equal(stoogeRanks(void 0), void 0, 'should return undefined for undefined values');

    function MoreStooges() { this.shemp = 87; }
    MoreStooges.prototype = {curly: 2, moe: 1, larry: 3};
    var moreStoogeRanks = _.propertyOf(new MoreStooges());
    assert.equal(moreStoogeRanks('curly'), 2, 'should return properties from further up the prototype chain');

    var nullPropertyOf = _.propertyOf(null);
    assert.equal(nullPropertyOf('curly'), void 0, 'should return undefined when obj is null');

    var undefPropertyOf = _.propertyOf(void 0);
    assert.equal(undefPropertyOf('curly'), void 0, 'should return undefined when obj is undefined');
  });

  QUnit.test('random', function(assert) {
    var array = _.range(1000);
    var min = Math.pow(2, 31);
    var max = Math.pow(2, 62);

    assert.ok(_.every(array, function() {
      return _.random(min, max) >= min;
    }), 'should produce a random number greater than or equal to the minimum number');

    assert.ok(_.some(array, function() {
      return _.random(Number.MAX_VALUE) > 0;
    }), 'should produce a random number when passed `Number.MAX_VALUE`');
  });

  QUnit.test('now', function(assert) {
    var diff = _.now() - new Date().getTime();
    assert.ok(diff <= 0 && diff > -5, 'Produces the correct time in milliseconds');//within 5ms
  });

  QUnit.test('uniqueId', function(assert) {
    var ids = [], i = 0;
    while (i++ < 100) ids.push(_.uniqueId());
    assert.equal(_.uniq(ids).length, ids.length, 'can generate a globally-unique stream of ids');
  });

  QUnit.test('times', function(assert) {
    var vals = [];
    _.times(3, function(i) { vals.push(i); });
    assert.deepEqual(vals, [0, 1, 2], 'is 0 indexed');
    //
    vals = [];
    _(3).times(function(i) { vals.push(i); });
    assert.deepEqual(vals, [0, 1, 2], 'works as a wrapper');
    // collects return values
    assert.deepEqual([0, 1, 2], _.times(3, function(i) { return i; }), 'collects return values');

    assert.deepEqual(_.times(0, _.identity), []);
    assert.deepEqual(_.times(-1, _.identity), []);
    assert.deepEqual(_.times(parseFloat('-Infinity'), _.identity), []);
  });

  QUnit.test('mixin', function(assert) {
    var ret = _.mixin({
      myReverse: function(string) {
        return string.split('').reverse().join('');
      }
    });
    assert.equal(ret, _, 'returns the _ object to facilitate chaining');
    assert.equal(_.myReverse('panacea'), 'aecanap', 'mixed in a function to _');
    assert.equal(_('champ').myReverse(), 'pmahc', 'mixed in a function to the OOP wrapper');
  });

  QUnit.test('_.escape', function(assert) {
    assert.equal(_.escape(null), '');
  });

  QUnit.test('_.unescape', function(assert) {
    var string = 'Curly & Moe';
    assert.equal(_.unescape(null), '');
    assert.equal(_.unescape(_.escape(string)), string);
    assert.equal(_.unescape(string), string, 'don\'t unescape unnecessarily');
  });

  // Don't care what they escape them to just that they're escaped and can be unescaped
  QUnit.test('_.escape & unescape', function(assert) {
    // test & (&amp;) seperately obviously
    var escapeCharacters = ['<', '>', '"', '\'', '`'];

    _.each(escapeCharacters, function(escapeChar) {
      var s = 'a ' + escapeChar + ' string escaped';
      var e = _.escape(s);
      assert.notEqual(s, e, escapeChar + ' is escaped');
      assert.equal(s, _.unescape(e), escapeChar + ' can be unescaped');

      s = 'a ' + escapeChar + escapeChar + escapeChar + 'some more string' + escapeChar;
      e = _.escape(s);

      assert.equal(e.indexOf(escapeChar), -1, 'can escape multiple occurances of ' + escapeChar);
      assert.equal(_.unescape(e), s, 'multiple occurrences of ' + escapeChar + ' can be unescaped');
    });

    // handles multiple escape characters at once
    var joiner = ' other stuff ';
    var allEscaped = escapeCharacters.join(joiner);
    allEscaped += allEscaped;
    assert.ok(_.every(escapeCharacters, function(escapeChar) {
      return allEscaped.indexOf(escapeChar) !== -1;
    }), 'handles multiple characters');
    assert.ok(allEscaped.indexOf(joiner) >= 0, 'can escape multiple escape characters at the same time');

    // test & -> &amp;
    var str = 'some string & another string & yet another';
    var escaped = _.escape(str);

    assert.notStrictEqual(escaped.indexOf('&'), -1, 'handles & aka &amp;');
    assert.equal(_.unescape(str), str, 'can unescape &amp;');
  });

  QUnit.test('template', function(assert) {
    var basicTemplate = _.template("<%= thing %> is gettin' on my noives!");
    var result = basicTemplate({thing: 'This'});
    assert.equal(result, "This is gettin' on my noives!", 'can do basic attribute interpolation');

    var sansSemicolonTemplate = _.template('A <% this %> B');
    assert.equal(sansSemicolonTemplate(), 'A  B');

    var backslashTemplate = _.template('<%= thing %> is \\ridanculous');
    assert.equal(backslashTemplate({thing: 'This'}), 'This is \\ridanculous');

    var escapeTemplate = _.template('<%= a ? "checked=\\"checked\\"" : "" %>');
    assert.equal(escapeTemplate({a: true}), 'checked="checked"', 'can handle slash escapes in interpolations.');

    var fancyTemplate = _.template('<ul><% ' +
    '  for (var key in people) { ' +
    '%><li><%= people[key] %></li><% } %></ul>');
    result = fancyTemplate({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}});
    assert.equal(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates');

    var escapedCharsInJavascriptTemplate = _.template('<ul><% _.each(numbers.split("\\n"), function(item) { %><li><%= item %></li><% }) %></ul>');
    result = escapedCharsInJavascriptTemplate({numbers: 'one\ntwo\nthree\nfour'});
    assert.equal(result, '<ul><li>one</li><li>two</li><li>three</li><li>four</li></ul>', 'Can use escaped characters (e.g. \\n) in JavaScript');

    var namespaceCollisionTemplate = _.template('<%= pageCount %> <%= thumbnails[pageCount] %> <% _.each(thumbnails, function(p) { %><div class="thumbnail" rel="<%= p %>"></div><% }); %>');
    result = namespaceCollisionTemplate({
      pageCount: 3,
      thumbnails: {
        1: 'p1-thumbnail.gif',
        2: 'p2-thumbnail.gif',
        3: 'p3-thumbnail.gif'
      }
    });
    assert.equal(result, '3 p3-thumbnail.gif <div class="thumbnail" rel="p1-thumbnail.gif"></div><div class="thumbnail" rel="p2-thumbnail.gif"></div><div class="thumbnail" rel="p3-thumbnail.gif"></div>');

    var noInterpolateTemplate = _.template('<div><p>Just some text. Hey, I know this is silly but it aids consistency.</p></div>');
    result = noInterpolateTemplate();
    assert.equal(result, '<div><p>Just some text. Hey, I know this is silly but it aids consistency.</p></div>');

    var quoteTemplate = _.template("It's its, not it's");
    assert.equal(quoteTemplate({}), "It's its, not it's");

    var quoteInStatementAndBody = _.template('<% ' +
    "  if(foo == 'bar'){ " +
    "%>Statement quotes and 'quotes'.<% } %>");
    assert.equal(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.");

    var withNewlinesAndTabs = _.template('This\n\t\tis: <%= x %>.\n\tok.\nend.');
    assert.equal(withNewlinesAndTabs({x: 'that'}), 'This\n\t\tis: that.\n\tok.\nend.');

    var template = _.template('<i><%- value %></i>');
    result = template({value: '<script>'});
    assert.equal(result, '<i>&lt;script&gt;</i>');

    var stooge = {
      name: 'Moe',
      template: _.template("I'm <%= this.name %>")
    };
    assert.equal(stooge.template(), "I'm Moe");

    template = _.template('\n ' +
    '  <%\n ' +
    '  // a comment\n ' +
    '  if (data) { data += 12345; }; %>\n ' +
    '  <li><%= data %></li>\n '
    );
    assert.equal(template({data: 12345}).replace(/\s/g, ''), '<li>24690</li>');

    _.templateSettings = {
      evaluate: /\{\{([\s\S]+?)\}\}/g,
      interpolate: /\{\{=([\s\S]+?)\}\}/g
    };

    var custom = _.template('<ul>{{ for (var key in people) { }}<li>{{= people[key] }}</li>{{ } }}</ul>');
    result = custom({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}});
    assert.equal(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates');

    var customQuote = _.template("It's its, not it's");
    assert.equal(customQuote({}), "It's its, not it's");

    quoteInStatementAndBody = _.template("{{ if(foo == 'bar'){ }}Statement quotes and 'quotes'.{{ } }}");
    assert.equal(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.");

    _.templateSettings = {
      evaluate: /<\?([\s\S]+?)\?>/g,
      interpolate: /<\?=([\s\S]+?)\?>/g
    };

    var customWithSpecialChars = _.template('<ul><? for (var key in people) { ?><li><?= people[key] ?></li><? } ?></ul>');
    result = customWithSpecialChars({people: {moe: 'Moe', larry: 'Larry', curly: 'Curly'}});
    assert.equal(result, '<ul><li>Moe</li><li>Larry</li><li>Curly</li></ul>', 'can run arbitrary javascript in templates');

    var customWithSpecialCharsQuote = _.template("It's its, not it's");
    assert.equal(customWithSpecialCharsQuote({}), "It's its, not it's");

    quoteInStatementAndBody = _.template("<? if(foo == 'bar'){ ?>Statement quotes and 'quotes'.<? } ?>");
    assert.equal(quoteInStatementAndBody({foo: 'bar'}), "Statement quotes and 'quotes'.");

    _.templateSettings = {
      interpolate: /\{\{(.+?)\}\}/g
    };

    var mustache = _.template('Hello {{planet}}!');
    assert.equal(mustache({planet: 'World'}), 'Hello World!', 'can mimic mustache.js');

    var templateWithNull = _.template('a null undefined {{planet}}');
    assert.equal(templateWithNull({planet: 'world'}), 'a null undefined world', 'can handle missing escape and evaluate settings');
  });

  QUnit.test('_.template provides the generated function source, when a SyntaxError occurs', function(assert) {
    var source;
    try {
      _.template('<b><%= if x %></b>');
    } catch (ex) {
      source = ex.source;
    }
    assert.ok(/__p/.test(source));
  });

  QUnit.test('_.template handles \\u2028 & \\u2029', function(assert) {
    var tmpl = _.template('<p>\u2028<%= "\\u2028\\u2029" %>\u2029</p>');
    assert.strictEqual(tmpl(), '<p>\u2028\u2028\u2029\u2029</p>');
  });

  QUnit.test('result calls functions and returns primitives', function(assert) {
    var obj = {w: '', x: 'x', y: function(){ return this.x; }};
    assert.strictEqual(_.result(obj, 'w'), '');
    assert.strictEqual(_.result(obj, 'x'), 'x');
    assert.strictEqual(_.result(obj, 'y'), 'x');
    assert.strictEqual(_.result(obj, 'z'), void 0);
    assert.strictEqual(_.result(null, 'x'), void 0);
  });

  QUnit.test('result returns a default value if object is null or undefined', function(assert) {
    assert.strictEqual(_.result(null, 'b', 'default'), 'default');
    assert.strictEqual(_.result(void 0, 'c', 'default'), 'default');
    assert.strictEqual(_.result(''.match('missing'), 1, 'default'), 'default');
  });

  QUnit.test('result returns a default value if property of object is missing', function(assert) {
    assert.strictEqual(_.result({d: null}, 'd', 'default'), null);
    assert.strictEqual(_.result({e: false}, 'e', 'default'), false);
  });

  QUnit.test('result only returns the default value if the object does not have the property or is undefined', function(assert) {
    assert.strictEqual(_.result({}, 'b', 'default'), 'default');
    assert.strictEqual(_.result({d: void 0}, 'd', 'default'), 'default');
  });

  QUnit.test('result does not return the default if the property of an object is found in the prototype', function(assert) {
    var Foo = function(){};
    Foo.prototype.bar = 1;
    assert.strictEqual(_.result(new Foo, 'bar', 2), 1);
  });

  QUnit.test('result does use the fallback when the result of invoking the property is undefined', function(assert) {
    var obj = {a: function() {}};
    assert.strictEqual(_.result(obj, 'a', 'failed'), void 0);
  });

  QUnit.test('result fallback can use a function', function(assert) {
    var obj = {a: [1, 2, 3]};
    assert.strictEqual(_.result(obj, 'b', _.constant(5)), 5);
    assert.strictEqual(_.result(obj, 'b', function() {
      return this.a;
    }), obj.a, 'called with context');
  });

  QUnit.test('_.templateSettings.variable', function(assert) {
    var s = '<%=data.x%>';
    var data = {x: 'x'};
    var tmp = _.template(s, {variable: 'data'});
    assert.strictEqual(tmp(data), 'x');
    _.templateSettings.variable = 'data';
    assert.strictEqual(_.template(s)(data), 'x');
  });

  QUnit.test('#547 - _.templateSettings is unchanged by custom settings.', function(assert) {
    assert.notOk(_.templateSettings.variable);
    _.template('', {}, {variable: 'x'});
    assert.notOk(_.templateSettings.variable);
  });

  QUnit.test('#556 - undefined template variables.', function(assert) {
    var template = _.template('<%=x%>');
    assert.strictEqual(template({x: null}), '');
    assert.strictEqual(template({x: void 0}), '');

    var templateEscaped = _.template('<%-x%>');
    assert.strictEqual(templateEscaped({x: null}), '');
    assert.strictEqual(templateEscaped({x: void 0}), '');

    var templateWithProperty = _.template('<%=x.foo%>');
    assert.strictEqual(templateWithProperty({x: {}}), '');
    assert.strictEqual(templateWithProperty({x: {}}), '');

    var templateWithPropertyEscaped = _.template('<%-x.foo%>');
    assert.strictEqual(templateWithPropertyEscaped({x: {}}), '');
    assert.strictEqual(templateWithPropertyEscaped({x: {}}), '');
  });

  QUnit.test('interpolate evaluates code only once.', function(assert) {
    assert.expect(2);
    var count = 0;
    var template = _.template('<%= f() %>');
    template({f: function(){ assert.notOk(count++); }});

    var countEscaped = 0;
    var templateEscaped = _.template('<%- f() %>');
    templateEscaped({f: function(){ assert.notOk(countEscaped++); }});
  });

  QUnit.test('#746 - _.template settings are not modified.', function(assert) {
    assert.expect(1);
    var settings = {};
    _.template('', null, settings);
    assert.deepEqual(settings, {});
  });

  QUnit.test('#779 - delimeters are applied to unescaped text.', function(assert) {
    assert.expect(1);
    var template = _.template('<<\nx\n>>', null, {evaluate: /<<(.*?)>>/g});
    assert.strictEqual(template(), '<<\nx\n>>');
  });

}());
