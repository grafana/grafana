/* */ 
(function(Buffer) {
  var assert = require('assert');
  var asn1 = require('../lib/asn1');
  var fixtures = require('./fixtures');
  var jsonEqual = fixtures.jsonEqual;
  var Buffer = require('buffer').Buffer;
  describe('asn1.js ping/pong', function() {
    function test(name, model, input, expected) {
      it('should support ' + name, function() {
        var M = asn1.define('TestModel', model);
        var encoded = M.encode(input, 'der');
        var decoded = M.decode(encoded, 'der');
        jsonEqual(decoded, expected !== undefined ? expected : input);
      });
    }
    describe('primitives', function() {
      test('bigint', function() {
        this.int();
      }, new asn1.bignum('0102030405060708', 16));
      test('enum', function() {
        this.enum({
          0: 'hello',
          1: 'world'
        });
      }, 'world');
      test('octstr', function() {
        this.octstr();
      }, new Buffer('hello'));
      test('bitstr', function() {
        this.bitstr();
      }, {
        unused: 4,
        data: new Buffer('hello!')
      });
      test('ia5str', function() {
        this.ia5str();
      }, 'hello');
      test('utf8str', function() {
        this.utf8str();
      }, 'hello');
      test('bmpstr', function() {
        this.bmpstr();
      }, 'hello');
      test('numstr', function() {
        this.numstr();
      }, '1234 5678 90');
      test('printstr', function() {
        this.printstr();
      }, 'hello');
      test('gentime', function() {
        this.gentime();
      }, 1385921175000);
      test('utctime', function() {
        this.utctime();
      }, 1385921175000);
      test('utctime regression', function() {
        this.utctime();
      }, 1414454400000);
      test('null', function() {
        this.null_();
      }, null);
      test('objid', function() {
        this.objid({'1 3 6 1 5 5 7 48 1 1': 'id-pkix-ocsp-basic'});
      }, 'id-pkix-ocsp-basic');
      test('true', function() {
        this.bool();
      }, true);
      test('false', function() {
        this.bool();
      }, false);
      test('any', function() {
        this.any();
      }, new Buffer('02210081347a0d3d674aeeb563061d94a3aea5f6a7' + 'c6dc153ea90a42c1ca41929ac1b9', 'hex'));
      test('default explicit', function() {
        this.seq().obj(this.key('version').def('v1').explicit(0).int({
          0: 'v1',
          1: 'v2'
        }));
      }, {}, {'version': 'v1'});
      test('implicit', function() {
        this.implicit(0).int({
          0: 'v1',
          1: 'v2'
        });
      }, 'v2', 'v2');
    });
    describe('composite', function() {
      test('2x int', function() {
        this.seq().obj(this.key('hello').int(), this.key('world').int());
      }, {
        hello: 4,
        world: 2
      });
      test('enum', function() {
        this.seq().obj(this.key('hello').enum({
          0: 'world',
          1: 'devs'
        }));
      }, {hello: 'devs'});
      test('optionals', function() {
        this.seq().obj(this.key('hello').enum({
          0: 'world',
          1: 'devs'
        }), this.key('how').optional().def('are you').enum({
          0: 'are you',
          1: 'are we?!'
        }));
      }, {
        hello: 'devs',
        how: 'are we?!'
      });
      test('optionals #2', function() {
        this.seq().obj(this.key('hello').enum({
          0: 'world',
          1: 'devs'
        }), this.key('how').optional().def('are you').enum({
          0: 'are you',
          1: 'are we?!'
        }));
      }, {hello: 'devs'}, {
        hello: 'devs',
        how: 'are you'
      });
      test('optionals #3', function() {
        this.seq().obj(this.key('content').optional().int());
      }, {}, {});
      test('optional + any', function() {
        this.seq().obj(this.key('content').optional().any());
      }, {content: new Buffer('0500', 'hex')});
      test('seqof', function() {
        var S = asn1.define('S', function() {
          this.seq().obj(this.key('a').def('b').int({
            0: 'a',
            1: 'b'
          }), this.key('c').def('d').int({
            2: 'c',
            3: 'd'
          }));
        });
        this.seqof(S);
      }, [{}, {
        a: 'a',
        c: 'c'
      }], [{
        a: 'b',
        c: 'd'
      }, {
        a: 'a',
        c: 'c'
      }]);
      test('choice', function() {
        this.choice({apple: this.bool()});
      }, {
        type: 'apple',
        value: true
      });
    });
  });
})(require('buffer').Buffer);
