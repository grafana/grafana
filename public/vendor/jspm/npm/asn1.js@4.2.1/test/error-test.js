/* */ 
(function(Buffer) {
  var assert = require('assert');
  var asn1 = require('../lib/asn1');
  var bn = asn1.bignum;
  var fixtures = require('./fixtures');
  var jsonEqual = fixtures.jsonEqual;
  var Buffer = require('buffer').Buffer;
  describe('asn1.js error', function() {
    describe('encoder', function() {
      function test(name, model, input, expected) {
        it('should support ' + name, function() {
          var M = asn1.define('TestModel', model);
          var error;
          assert.throws(function() {
            try {
              var encoded = M.encode(input, 'der');
            } catch (e) {
              error = e;
              throw e;
            }
          });
          assert(expected.test(error.stack), 'Failed to match, expected: ' + expected + ' got: ' + JSON.stringify(error.stack));
        });
      }
      describe('primitives', function() {
        test('int', function() {
          this.int();
        }, 'hello', /no values map/i);
        test('enum', function() {
          this.enum({
            0: 'hello',
            1: 'world'
          });
        }, 'gosh', /contain: "gosh"/);
        test('objid', function() {
          this.objid();
        }, 1, /objid\(\) should be either array or string, got: 1/);
        test('numstr', function() {
          this.numstr();
        }, 'hello', /only digits and space/);
        test('printstr', function() {
          this.printstr();
        }, 'hello!', /only latin upper and lower case letters/);
      });
      describe('composite', function() {
        test('shallow', function() {
          this.seq().obj(this.key('key').int());
        }, {key: 'hello'}, /map at: \["key"\]/i);
        test('deep and empty', function() {
          this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int())));
        }, {}, /input is not object at: \["a"\]\["b"\]/i);
        test('deep', function() {
          this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int())));
        }, {a: {b: {c: 'hello'}}}, /map at: \["a"\]\["b"\]\["c"\]/i);
        test('use', function() {
          var S = asn1.define('S', function() {
            this.seq().obj(this.key('x').int());
          });
          this.seq().obj(this.key('a').seq().obj(this.key('b').use(S)));
        }, {a: {b: {x: 'hello'}}}, /map at: \["a"\]\["b"\]\["x"\]/i);
      });
    });
    describe('decoder', function() {
      function test(name, model, input, expected) {
        it('should support ' + name, function() {
          var M = asn1.define('TestModel', model);
          var error;
          assert.throws(function() {
            try {
              var decoded = M.decode(new Buffer(input, 'hex'), 'der');
            } catch (e) {
              error = e;
              throw e;
            }
          });
          var partial = M.decode(new Buffer(input, 'hex'), 'der', {partial: true});
          assert(expected.test(error.stack), 'Failed to match, expected: ' + expected + ' got: ' + JSON.stringify(error.stack));
          assert.equal(partial.errors.length, 1);
          assert(expected.test(partial.errors[0].stack), 'Failed to match, expected: ' + expected + ' got: ' + JSON.stringify(partial.errors[0].stack));
        });
      }
      describe('primitive', function() {
        test('int', function() {
          this.int();
        }, '2201', /body of: "int"/);
        test('int', function() {
          this.int();
        }, '', /tag of "int"/);
        test('bmpstr invalid length', function() {
          this.bmpstr();
        }, '1e0b041f04400438043204350442', /bmpstr length mismatch/);
        test('numstr unsupported characters', function() {
          this.numstr();
        }, '12024141', /numstr unsupported characters/);
        test('printstr unsupported characters', function() {
          this.printstr();
        }, '13024121', /printstr unsupported characters/);
      });
      describe('composite', function() {
        test('shallow', function() {
          this.seq().obj(this.key('a').seq().obj());
        }, '30', /length of "seq"/);
        test('deep and empty', function() {
          this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int())));
        }, '300430023000', /tag of "int" at: \["a"\]\["b"\]\["c"\]/);
        test('deep and incomplete', function() {
          this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int())));
        }, '30053003300122', /length of "int" at: \["a"\]\["b"\]\["c"\]/);
      });
    });
    describe('partial decoder', function() {
      function test(name, model, input, expectedObj, expectedErrs) {
        it('should support ' + name, function() {
          var M = asn1.define('TestModel', model);
          var decoded = M.decode(new Buffer(input, 'hex'), 'der', {partial: true});
          jsonEqual(decoded.result, expectedObj);
          assert.equal(decoded.errors.length, expectedErrs.length);
          expectedErrs.forEach(function(expected, i) {
            assert(expected.test(decoded.errors[i].stack), 'Failed to match, expected: ' + expected + ' got: ' + JSON.stringify(decoded.errors[i].stack));
          });
        });
      }
      test('last key not present', function() {
        this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int()), this.key('d').int()));
      }, '30073005300022012e', {a: {
          b: {},
          d: new bn(46)
        }}, [/"int" at: \["a"\]\["b"\]\["c"\]/]);
      test('first key not present', function() {
        this.seq().obj(this.key('a').seq().obj(this.key('b').seq().obj(this.key('c').int()), this.key('d').int()));
      }, '30073005300322012e', {a: {b: {c: new bn(46)}}}, [/"int" at: \["a"\]\["d"\]/]);
    });
  });
})(require('buffer').Buffer);
