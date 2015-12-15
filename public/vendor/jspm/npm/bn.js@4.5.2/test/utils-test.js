/* */ 
(function(Buffer) {
  var assert = require('assert');
  var BN = require('../lib/bn').BN;
  var fixtures = require('./fixtures');
  describe('BN.js/Utils', function() {
    describe('.toString()', function() {
      describe('binary padding', function() {
        it('should have a length of 256', function() {
          var a = new BN(0);
          assert.equal(a.toString(2, 256).length, 256);
        });
      });
      describe('hex padding', function() {
        it('should have length of 8 from leading 15', function() {
          var a = new BN('ffb9602', 16);
          var b = new Buffer(a.toString('hex', 2), 'hex');
          assert.equal(a.toString('hex', 2).length, 8);
        });
        it('should have length of 8 from leading zero', function() {
          var a = new BN('fb9604', 16);
          var b = new Buffer(a.toString('hex', 8), 'hex');
          assert.equal(a.toString('hex', 8).length, 8);
        });
        it('should have length of 8 from leading zeros', function() {
          var a = new BN(0);
          var b = new Buffer(a.toString('hex', 8), 'hex');
          assert.equal(a.toString('hex', 8).length, 8);
        });
        it('should have length of 64 from leading 15', function() {
          var a = new BN('ffb96ff654e61130ba8422f0debca77a0ea74ae5ea8bca9b54ab64aabf01003', 16);
          var b = new Buffer(a.toString('hex', 2), 'hex');
          assert.equal(a.toString('hex', 2).length, 64);
        });
        it('should have length of 64 from leading zero', function() {
          var a = new BN('fb96ff654e61130ba8422f0debca77a0ea74ae5ea8bca9b54ab64aabf01003', 16);
          var b = new Buffer(a.toString('hex', 64), 'hex');
          assert.equal(a.toString('hex', 64).length, 64);
        });
      });
    });
    describe('.isNeg()', function() {
      it('should return true for negative numbers', function() {
        assert.equal(new BN(-1).isNeg(), true);
        assert.equal(new BN(1).isNeg(), false);
        assert.equal(new BN(0).isNeg(), false);
        assert.equal(new BN('-0', 10).isNeg(), false);
      });
    });
    describe('.isOdd()', function() {
      it('should return true for odd numbers', function() {
        assert.equal(new BN(0).isOdd(), false);
        assert.equal(new BN(1).isOdd(), true);
        assert.equal(new BN(2).isOdd(), false);
        assert.equal(new BN('-0', 10).isOdd(), false);
        assert.equal(new BN('-1', 10).isOdd(), true);
        assert.equal(new BN('-2', 10).isOdd(), false);
      });
    });
    describe('.isEven()', function() {
      it('should return true for even numbers', function() {
        assert.equal(new BN(0).isEven(), true);
        assert.equal(new BN(1).isEven(), false);
        assert.equal(new BN(2).isEven(), true);
        assert.equal(new BN('-0', 10).isEven(), true);
        assert.equal(new BN('-1', 10).isEven(), false);
        assert.equal(new BN('-2', 10).isEven(), true);
      });
    });
    describe('.isZero()', function() {
      it('should return true for zero', function() {
        assert.equal(new BN(0).isZero(), true);
        assert.equal(new BN(1).isZero(), false);
        assert.equal(new BN(0xffffffff).isZero(), false);
      });
    });
    describe('.bitLength()', function() {
      it('should return proper bitLength', function() {
        assert.equal(new BN(0).bitLength(), 0);
        assert.equal(new BN(0x1).bitLength(), 1);
        assert.equal(new BN(0x2).bitLength(), 2);
        assert.equal(new BN(0x3).bitLength(), 2);
        assert.equal(new BN(0x4).bitLength(), 3);
        assert.equal(new BN(0x8).bitLength(), 4);
        assert.equal(new BN(0x10).bitLength(), 5);
        assert.equal(new BN(0x100).bitLength(), 9);
        assert.equal(new BN(0x123456).bitLength(), 21);
        assert.equal(new BN('123456789', 16).bitLength(), 33);
        assert.equal(new BN('8023456789', 16).bitLength(), 40);
      });
    });
    describe('.byteLength()', function() {
      it('should return proper byteLength', function() {
        assert.equal(new BN(0).byteLength(), 0);
        assert.equal(new BN(0x1).byteLength(), 1);
        assert.equal(new BN(0x2).byteLength(), 1);
        assert.equal(new BN(0x3).byteLength(), 1);
        assert.equal(new BN(0x4).byteLength(), 1);
        assert.equal(new BN(0x8).byteLength(), 1);
        assert.equal(new BN(0x10).byteLength(), 1);
        assert.equal(new BN(0x100).byteLength(), 2);
        assert.equal(new BN(0x123456).byteLength(), 3);
        assert.equal(new BN('123456789', 16).byteLength(), 5);
        assert.equal(new BN('8023456789', 16).byteLength(), 5);
      });
    });
    describe('.toArray()', function() {
      it('should zero pad to desired lengths', function() {
        var n = new BN(0x123456);
        assert.deepEqual(n.toArray('be', 5), [0x00, 0x00, 0x12, 0x34, 0x56]);
        assert.deepEqual(n.toArray('le', 5), [0x56, 0x34, 0x12, 0x00, 0x00]);
      });
      it('should throw when naturally larger than desired length', function() {
        var n = new BN(0x123456);
        assert.throws(function() {
          n.toArray('be', 2);
        });
      });
    });
    describe('.toNumber()', function() {
      it('should return proper Number if below the limit', function() {
        var n = new BN(0x123456);
        assert.deepEqual(n.toNumber(), 0x123456);
      });
      it('should throw when number exceeds 53 bits', function() {
        var n = new BN(1).iushln(54);
        assert.throws(function() {
          n.toNumber();
        });
      });
    });
    describe('.zeroBits()', function() {
      it('should return proper zeroBits', function() {
        assert.equal(new BN(0).zeroBits(), 0);
        assert.equal(new BN(0x1).zeroBits(), 0);
        assert.equal(new BN(0x2).zeroBits(), 1);
        assert.equal(new BN(0x3).zeroBits(), 0);
        assert.equal(new BN(0x4).zeroBits(), 2);
        assert.equal(new BN(0x8).zeroBits(), 3);
        assert.equal(new BN(0x10).zeroBits(), 4);
        assert.equal(new BN(0x100).zeroBits(), 8);
        assert.equal(new BN(0x1000000).zeroBits(), 24);
        assert.equal(new BN(0x123456).zeroBits(), 1);
      });
    });
    describe('.toJSON', function() {
      it('should return hex string', function() {
        assert.equal(new BN(0x123).toJSON(), '123');
      });
    });
    describe('.cmpn', function() {
      it('should return -1, 0, 1 correctly', function() {
        assert.equal(new BN(42).cmpn(42), 0);
        assert.equal(new BN(42).cmpn(43), -1);
        assert.equal(new BN(42).cmpn(41), 1);
        assert.equal(new BN(0x3fffffe).cmpn(0x3fffffe), 0);
        assert.equal(new BN(0x3fffffe).cmpn(0x3ffffff), -1);
        assert.equal(new BN(0x3fffffe).cmpn(0x3fffffd), 1);
        assert.throws(function() {
          new BN(0x3fffffe).cmpn(0x4000000);
        });
        assert.equal(new BN(42).cmpn(-42), 1);
        assert.equal(new BN(-42).cmpn(42), -1);
        assert.equal(new BN(-42).cmpn(-42), 0);
      });
    });
    describe('.cmp', function() {
      it('should return -1, 0, 1 correctly', function() {
        assert.equal(new BN(42).cmp(new BN(42)), 0);
        assert.equal(new BN(42).cmp(new BN(43)), -1);
        assert.equal(new BN(42).cmp(new BN(41)), 1);
        assert.equal(new BN(0x3fffffe).cmp(new BN(0x3fffffe)), 0);
        assert.equal(new BN(0x3fffffe).cmp(new BN(0x3ffffff)), -1);
        assert.equal(new BN(0x3fffffe).cmp(new BN(0x3fffffd)), 1);
        assert.equal(new BN(0x3fffffe).cmp(new BN(0x4000000)), -1);
        assert.equal(new BN(42).cmp(new BN(-42)), 1);
        assert.equal(new BN(-42).cmp(new BN(42)), -1);
        assert.equal(new BN(-42).cmp(new BN(-42)), 0);
      });
    });
  });
})(require('buffer').Buffer);
