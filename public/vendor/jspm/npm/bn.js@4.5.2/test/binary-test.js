/* */ 
var assert = require('assert');
var BN = require('../lib/bn').BN;
var fixtures = require('./fixtures');
describe('BN.js/Binary', function() {
  describe('.shl()', function() {
    it('should shl numbers', function() {
      assert.equal(new BN('69527932928').shln(13).toString(16), '2060602000000');
      assert.equal(new BN('69527932928').shln(45).toString(16), '206060200000000000000');
    });
    it('should ushl numbers', function() {
      assert.equal(new BN('69527932928').ushln(13).toString(16), '2060602000000');
      assert.equal(new BN('69527932928').ushln(45).toString(16), '206060200000000000000');
    });
  });
  describe('.shr()', function() {
    it('should shr numbers', function() {
      assert.equal(new BN('69527932928').shrn(13).toString(16), '818180');
      assert.equal(new BN('69527932928').shrn(17).toString(16), '81818');
      assert.equal(new BN('69527932928').shrn(256).toString(16), '0');
    });
    it('should ushr numbers', function() {
      assert.equal(new BN('69527932928').ushrn(13).toString(16), '818180');
      assert.equal(new BN('69527932928').ushrn(17).toString(16), '81818');
      assert.equal(new BN('69527932928').ushrn(256).toString(16), '0');
    });
  });
  describe('.bincn()', function() {
    it('should increment bit', function() {
      assert.equal(new BN(0).bincn(1).toString(16), '2');
      assert.equal(new BN(2).bincn(1).toString(16), '4');
      assert.equal(new BN(2).bincn(1).bincn(1).toString(16), new BN(2).bincn(2).toString(16));
      assert.equal(new BN(0xffffff).bincn(1).toString(16), '1000001');
    });
  });
  describe('.imaskn()', function() {
    it('should mask bits in-place', function() {
      assert.equal(new BN(0).imaskn(1).toString(16), '0');
      assert.equal(new BN(3).imaskn(1).toString(16), '1');
      assert.equal(new BN('123456789', 16).imaskn(4).toString(16), '9');
      assert.equal(new BN('123456789', 16).imaskn(16).toString(16), '6789');
      assert.equal(new BN('123456789', 16).imaskn(28).toString(16), '3456789');
    });
  });
  describe('.testn()', function() {
    it('should support test specific bit', function() {
      ['ff', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'].forEach(function(hex) {
        var bn = new BN(hex, 16);
        var bl = bn.bitLength();
        for (var i = 0; i < bl; ++i) {
          assert.equal(bn.testn(i), true);
        }
        assert.equal(bn.testn(bl), false);
      });
      var xbits = '01111001010111001001000100011101' + '11010011101100011000111001011101' + '10010100111000000001011000111101' + '01011111001111100100011110000010' + '01011010100111010001010011000100' + '01101001011110100001001111100110' + '001110010111';
      var x = new BN('23478905234580795234378912401239784125643978256123048348957342');
      for (var i = 0; i < x.bitLength(); ++i) {
        assert.equal(x.testn(i), (xbits.charAt(i) === '1'), 'Failed @ bit ' + i);
      }
    });
    it('should have short-cuts', function() {
      var x = new BN('abcd', 16);
      assert(!x.testn(128));
    });
  });
  describe('.and()', function() {
    it('should and numbers', function() {
      assert.equal(new BN('1010101010101010101010101010101010101010', 2).and(new BN('101010101010101010101010101010101010101', 2)).toString(2), '0');
    });
    it('should and numbers of different limb-length', function() {
      assert.equal(new BN('abcd0000ffff', 16).and(new BN('abcd', 16)).toString(16), 'abcd');
    });
  });
  describe('.iand()', function() {
    it('should iand numbers', function() {
      assert.equal(new BN('1010101010101010101010101010101010101010', 2).iand(new BN('101010101010101010101010101010101010101', 2)).toString(2), '0');
      assert.equal(new BN('1000000000000000000000000000000000000001', 2).iand(new BN('1', 2)).toString(2), '1');
      assert.equal(new BN('1', 2).iand(new BN('1000000000000000000000000000000000000001', 2)).toString(2), '1');
    });
  });
  describe('.or()', function() {
    it('should or numbers', function() {
      assert.equal(new BN('1010101010101010101010101010101010101010', 2).or(new BN('101010101010101010101010101010101010101', 2)).toString(2), '1111111111111111111111111111111111111111');
    });
    it('should or numbers of different limb-length', function() {
      assert.equal(new BN('abcd00000000', 16).or(new BN('abcd', 16)).toString(16), 'abcd0000abcd');
    });
  });
  describe('.ior()', function() {
    it('should ior numbers', function() {
      assert.equal(new BN('1010101010101010101010101010101010101010', 2).ior(new BN('101010101010101010101010101010101010101', 2)).toString(2), '1111111111111111111111111111111111111111');
      assert.equal(new BN('1000000000000000000000000000000000000000', 2).ior(new BN('1', 2)).toString(2), '1000000000000000000000000000000000000001');
      assert.equal(new BN('1', 2).ior(new BN('1000000000000000000000000000000000000000', 2)).toString(2), '1000000000000000000000000000000000000001');
    });
  });
  describe('.xor()', function() {
    it('should xor numbers', function() {
      assert.equal(new BN('11001100110011001100110011001100', 2).xor(new BN('1100110011001100110011001100110', 2)).toString(2), '10101010101010101010101010101010');
    });
  });
  describe('.ixor()', function() {
    it('should ixor numbers', function() {
      assert.equal(new BN('11001100110011001100110011001100', 2).ixor(new BN('1100110011001100110011001100110', 2)).toString(2), '10101010101010101010101010101010');
      assert.equal(new BN('11001100110011001100110011001100', 2).ixor(new BN('1', 2)).toString(2), '11001100110011001100110011001101');
      assert.equal(new BN('1', 2).ixor(new BN('11001100110011001100110011001100', 2)).toString(2), '11001100110011001100110011001101');
    });
    it('should and numbers of different limb-length', function() {
      assert.equal(new BN('abcd0000ffff', 16).xor(new BN('abcd', 16)).toString(16), 'abcd00005432');
    });
  });
  describe('.setn()', function() {
    it('should allow single bits to be set', function() {
      assert.equal(new BN(0).setn(2, true).toString(2), '100');
      assert.equal(new BN(0).setn(27, true).toString(2), '1000000000000000000000000000');
      assert.equal(new BN('1000000000000000000000000001', 2).setn(27, false).toString(2), '1');
      assert.equal(new BN('101', 2).setn(2, false).toString(2), '1');
    });
  });
});
