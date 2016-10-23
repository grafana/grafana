(function() {
  if (typeof document == 'undefined') return;

  var _ = typeof require == 'function' ? require('..') : window._;

  QUnit.module('Cross Document');
  /* global iObject, iElement, iArguments, iFunction, iArray, iError, iString, iNumber, iBoolean, iDate, iRegExp, iNaN, iNull, iUndefined, ActiveXObject */

  // Setup remote variables for iFrame tests.
  var iframe = document.createElement('iframe');
  iframe.frameBorder = iframe.height = iframe.width = 0;
  document.body.appendChild(iframe);
  var iDoc = (iDoc = iframe.contentDocument || iframe.contentWindow).document || iDoc;
  iDoc.write(
    [
      '<script>',
      'parent.iElement = document.createElement("div");',
      'parent.iArguments = (function(){ return arguments; })(1, 2, 3);',
      'parent.iArray = [1, 2, 3];',
      'parent.iString = new String("hello");',
      'parent.iNumber = new Number(100);',
      'parent.iFunction = (function(){});',
      'parent.iDate = new Date();',
      'parent.iRegExp = /hi/;',
      'parent.iNaN = NaN;',
      'parent.iNull = null;',
      'parent.iBoolean = new Boolean(false);',
      'parent.iUndefined = undefined;',
      'parent.iObject = {};',
      'parent.iError = new Error();',
      '</script>'
    ].join('\n')
  );
  iDoc.close();

  QUnit.test('isEqual', function(assert) {

    assert.notOk(_.isEqual(iNumber, 101));
    assert.ok(_.isEqual(iNumber, 100));

    // Objects from another frame.
    assert.ok(_.isEqual({}, iObject), 'Objects with equivalent members created in different documents are equal');

    // Array from another frame.
    assert.ok(_.isEqual([1, 2, 3], iArray), 'Arrays with equivalent elements created in different documents are equal');
  });

  QUnit.test('isEmpty', function(assert) {
    assert.notOk(_([iNumber]).isEmpty(), '[1] is not empty');
    assert.notOk(_.isEmpty(iArray), '[] is empty');
    assert.ok(_.isEmpty(iObject), '{} is empty');
  });

  QUnit.test('isElement', function(assert) {
    assert.notOk(_.isElement('div'), 'strings are not dom elements');
    assert.ok(_.isElement(document.body), 'the body tag is a DOM element');
    assert.ok(_.isElement(iElement), 'even from another frame');
  });

  QUnit.test('isArguments', function(assert) {
    assert.ok(_.isArguments(iArguments), 'even from another frame');
  });

  QUnit.test('isObject', function(assert) {
    assert.ok(_.isObject(iElement), 'even from another frame');
    assert.ok(_.isObject(iFunction), 'even from another frame');
  });

  QUnit.test('isArray', function(assert) {
    assert.ok(_.isArray(iArray), 'even from another frame');
  });

  QUnit.test('isString', function(assert) {
    assert.ok(_.isString(iString), 'even from another frame');
  });

  QUnit.test('isNumber', function(assert) {
    assert.ok(_.isNumber(iNumber), 'even from another frame');
  });

  QUnit.test('isBoolean', function(assert) {
    assert.ok(_.isBoolean(iBoolean), 'even from another frame');
  });

  QUnit.test('isFunction', function(assert) {
    assert.ok(_.isFunction(iFunction), 'even from another frame');
  });

  QUnit.test('isDate', function(assert) {
    assert.ok(_.isDate(iDate), 'even from another frame');
  });

  QUnit.test('isRegExp', function(assert) {
    assert.ok(_.isRegExp(iRegExp), 'even from another frame');
  });

  QUnit.test('isNaN', function(assert) {
    assert.ok(_.isNaN(iNaN), 'even from another frame');
  });

  QUnit.test('isNull', function(assert) {
    assert.ok(_.isNull(iNull), 'even from another frame');
  });

  QUnit.test('isUndefined', function(assert) {
    assert.ok(_.isUndefined(iUndefined), 'even from another frame');
  });

  QUnit.test('isError', function(assert) {
    assert.ok(_.isError(iError), 'even from another frame');
  });

  if (typeof ActiveXObject != 'undefined') {
    QUnit.test('IE host objects', function(assert) {
      var xml = new ActiveXObject('Msxml2.DOMDocument.3.0');
      assert.notOk(_.isNumber(xml));
      assert.notOk(_.isBoolean(xml));
      assert.notOk(_.isNaN(xml));
      assert.notOk(_.isFunction(xml));
      assert.notOk(_.isNull(xml));
      assert.notOk(_.isUndefined(xml));
    });

    QUnit.test('#1621 IE 11 compat mode DOM elements are not functions', function(assert) {
      var fn = function() {};
      var xml = new ActiveXObject('Msxml2.DOMDocument.3.0');
      var div = document.createElement('div');

      // JIT the function
      var count = 200;
      while (count--) {
        _.isFunction(fn);
      }

      assert.equal(_.isFunction(xml), false);
      assert.equal(_.isFunction(div), false);
      assert.equal(_.isFunction(fn), true);
    });
  }

}());
