/* */ 
var assert = require('assert');
var BN = require('../lib/bn').BN;
var fixtures = require('./fixtures');
describe('BN.js/Constructor', function() {
  describe('with Smi input', function() {
    it('should accept one limb number', function() {
      assert.equal(new BN(12345).toString(16), '3039');
    });
    it('should accept two-limb number', function() {
      assert.equal(new BN(0x4123456).toString(16), '4123456');
    });
    it('should accept 52 bits of precision', function() {
      var num = Math.pow(2, 52);
      assert.equal(new BN(num, 10).toString(10), num.toString(10));
    });
    it('should accept max safe integer', function() {
      var num = Math.pow(2, 53) - 1;
      assert.equal(new BN(num, 10).toString(10), num.toString(10));
    });
    it('should not accept an unsafe integer', function() {
      var num = Math.pow(2, 53);
      assert.throws(function() {
        new BN(num, 10);
      });
    });
    it('should accept two-limb LE number', function() {
      assert.equal(new BN(0x4123456, null, 'le').toString(16), '56341204');
    });
  });
  describe('with String input', function() {
    it('should accept base-16', function() {
      assert.equal(new BN('1A6B765D8CDF', 16).toString(16), '1a6b765d8cdf');
      assert.equal(new BN('1A6B765D8CDF', 16).toString(), '29048849665247');
    });
    it('should accept base-hex', function() {
      assert.equal(new BN('FF', 'hex').toString(), '255');
    });
    it('should accept base-16 with spaces', function() {
      var num = 'a89c e5af8724 c0a23e0e 0ff77500';
      assert.equal(new BN(num, 16).toString(16), num.replace(/ /g, ''));
    });
    it('should accept long base-16', function() {
      var num = '123456789abcdef123456789abcdef123456789abcdef';
      assert.equal(new BN(num, 16).toString(16), num);
    });
    it('should accept positive base-10', function() {
      assert.equal(new BN('10654321').toString(), '10654321');
      assert.equal(new BN('29048849665247').toString(16), '1a6b765d8cdf');
    });
    it('should accept negative base-10', function() {
      assert.equal(new BN('-29048849665247').toString(16), '-1a6b765d8cdf');
    });
    it('should accept long base-10', function() {
      var num = '10000000000000000';
      assert.equal(new BN(num).toString(10), num);
    });
    it('should accept base-2', function() {
      var base2 = '11111111111111111111111111111111111111111111111111111';
      assert.equal(new BN(base2, 2).toString(2), base2);
    });
    it('should accept base-36', function() {
      var base36 = 'zzZzzzZzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
      assert.equal(new BN(base36, 36).toString(36), base36.toLowerCase());
    });
    it('should not overflow limbs during base-10', function() {
      var num = '65820182292848241686198767302293' + '20890292528855852623664389292032';
      assert(new BN(num).words[0] < 0x4000000);
    });
    it('should accept base-16 LE integer', function() {
      assert.equal(new BN('1A6B765D8CDF', 16, 'le').toString(16), 'df8c5d766b1a');
    });
  });
  describe('with Array input', function() {
    it('should not fail on empty array', function() {
      assert.equal(new BN([]).toString(16), '0');
    });
    it('should import/export big endian', function() {
      assert.equal(new BN([1, 2, 3]).toString(16), '10203');
      assert.equal(new BN([1, 2, 3, 4]).toString(16), '1020304');
      assert.equal(new BN([1, 2, 3, 4, 5]).toString(16), '102030405');
      assert.equal(new BN([1, 2, 3, 4, 5, 6, 7, 8]).toString(16), '102030405060708');
      assert.equal(new BN([1, 2, 3, 4]).toArray().join(','), '1,2,3,4');
      assert.equal(new BN([1, 2, 3, 4, 5, 6, 7, 8]).toArray().join(','), '1,2,3,4,5,6,7,8');
    });
    it('should import little endian', function() {
      assert.equal(new BN([1, 2, 3], 10, 'le').toString(16), '30201');
      assert.equal(new BN([1, 2, 3, 4], 10, 'le').toString(16), '4030201');
      assert.equal(new BN([1, 2, 3, 4, 5], 10, 'le').toString(16), '504030201');
      assert.equal(new BN([1, 2, 3, 4, 5, 6, 7, 8], 'le').toString(16), '807060504030201');
      assert.equal(new BN([1, 2, 3, 4]).toArray('le').join(','), '4,3,2,1');
      assert.equal(new BN([1, 2, 3, 4, 5, 6, 7, 8]).toArray('le').join(','), '8,7,6,5,4,3,2,1');
    });
    it('should import big endian with implicit base', function() {
      assert.equal(new BN([1, 2, 3, 4, 5], 'le').toString(16), '504030201');
    });
  });
  describe('with BN input', function() {
    it('should clone BN', function() {
      var num = new BN(12345);
      assert.equal(new BN(num).toString(10), '12345');
    });
  });
});
