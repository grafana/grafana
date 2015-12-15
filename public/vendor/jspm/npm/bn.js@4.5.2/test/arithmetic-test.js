/* */ 
var assert = require('assert');
var BN = require('../lib/bn').BN;
var fixtures = require('./fixtures');
describe('BN.js/Arithmetic', function() {
  describe('.add()', function() {
    it('should add numbers', function() {
      assert.equal(new BN(14).add(new BN(26)).toString(16), '28');
      var k = new BN(0x1234);
      var r = k;
      for (var i = 0; i < 257; i++)
        r = r.add(k);
      assert.equal(r.toString(16), '125868');
    });
    it('should handle carry properly (in-place)', function() {
      var k = new BN('abcdefabcdefabcdef', 16);
      var r = new BN('deadbeef', 16);
      for (var i = 0; i < 257; i++)
        r.iadd(k);
      assert.equal(r.toString(16), 'ac79bd9b79be7a277bde');
    });
    it('should properly do positive + negative', function() {
      var a = new BN('abcd', 16);
      var b = new BN('-abce', 16);
      assert.equal(a.iadd(b).toString(16), '-1');
      var a = new BN('abcd', 16);
      var b = new BN('-abce', 16);
      assert.equal(a.add(b).toString(16), '-1');
      assert.equal(b.add(a).toString(16), '-1');
    });
  });
  describe('.iaddn()', function() {
    it('should allow a sign change', function() {
      var a = new BN(-100);
      assert.equal(a.negative, 1);
      a.iaddn(200);
      assert.equal(a.negative, 0);
      assert.equal(a.toString(), '100');
    });
    it('should add negative number', function() {
      var a = new BN(-100);
      assert.equal(a.negative, 1);
      a.iaddn(-200);
      assert.equal(a.toString(), '-300');
    });
    it('should allow neg + pos with big number', function() {
      var a = new BN('-1000000000', 10);
      assert.equal(a.negative, 1);
      a.iaddn(200);
      assert.equal(a.toString(), '-999999800');
    });
    it('should carry limb', function() {
      var a = new BN('3ffffff', 16);
      assert.equal(a.iaddn(1).toString(16), '4000000');
    });
  });
  describe('.sub()', function() {
    it('should subtract small numbers', function() {
      assert.equal(new BN(26).sub(new BN(14)).toString(16), 'c');
      assert.equal(new BN(14).sub(new BN(26)).toString(16), '-c');
      assert.equal(new BN(26).sub(new BN(26)).toString(16), '0');
      assert.equal(new BN(-26).sub(new BN(26)).toString(16), '-34');
    });
    var a = new BN('31ff3c61db2db84b9823d320907a573f6ad37c437abe458b1802cda041d6384' + 'a7d8daef41395491e2', 16);
    var b = new BN('6f0e4d9f1d6071c183677f601af9305721c91d31b0bbbae8fb790000', 16);
    var r = new BN('31ff3c61db2db84b9823d3208989726578fd75276287cd9516533a9acfb9a67' + '76281f34583ddb91e2', 16);
    it('should subtract big numbers', function() {
      assert.equal(a.sub(b).cmp(r), 0);
    });
    it('should subtract numbers in place', function() {
      assert.equal(b.clone().isub(a).neg().cmp(r), 0);
    });
    it('should subtract with carry', function() {
      var a = new BN('12345', 16);
      var b = new BN('1000000000000', 16);
      assert.equal(a.isub(b).toString(16), '-fffffffedcbb');
      var a = new BN('12345', 16);
      var b = new BN('1000000000000', 16);
      assert.equal(b.isub(a).toString(16), 'fffffffedcbb');
    });
  });
  describe('.isubn()', function() {
    it('should subtract negative number', function() {
      var r = new BN('7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b', 16);
      assert.equal(r.isubn(-1).toString(16), '7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681c');
    });
    it('should work for positive numbers', function() {
      var a = new BN(-100);
      assert.equal(a.negative, 1);
      a.isubn(200);
      assert.equal(a.negative, 1);
      assert.equal(a.toString(), '-300');
    });
    it('should not allow a sign change', function() {
      var a = new BN(-100);
      assert.equal(a.negative, 1);
      a.isubn(-200);
      assert.equal(a.negative, 0);
      assert.equal(a.toString(), '100');
    });
    it('should change sign on small numbers at 0', function() {
      var a = new BN(0).subn(2);
      assert.equal(a.toString(), '-2');
    });
    it('should change sign on small numbers at 1', function() {
      var a = new BN(1).subn(2);
      assert.equal(a.toString(), '-1');
    });
  });
  function testMethod(name, mul) {
    describe(name, function() {
      it('should multiply numbers of different signs', function() {
        assert.equal(mul(new BN(0x1001), new BN(0x1234)).toString(16), '1235234');
        assert.equal(mul(new BN(-0x1001), new BN(0x1234)).toString(16), '-1235234');
        assert.equal(mul(new BN(-0x1001), new BN(-0x1234)).toString(16), '1235234');
      });
      it('should multiply with carry', function() {
        var n = new BN(0x1001);
        var r = n;
        for (var i = 0; i < 4; i++)
          r = mul(r, n);
        assert.equal(r.toString(16), '100500a00a005001');
      });
      it('should correctly multiply big numbers', function() {
        var n = new BN('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 16);
        assert.equal(mul(n, n).toString(16), '39e58a8055b6fb264b75ec8c646509784204ac15a8c24e05babc9729ab9' + 'b055c3a9458e4ce3289560a38e08ba8175a9446ce14e608245ab3a9' + '978a8bd8acaa40');
        assert.equal(mul(mul(n, n), n).toString(16), '1b888e01a06e974017a28a5b4da436169761c9730b7aeedf75fc60f687b' + '46e0cf2cb11667f795d5569482640fe5f628939467a01a612b02350' + '0d0161e9730279a7561043af6197798e41b7432458463e64fa81158' + '907322dc330562697d0d600');
      });
      it('should multiply neg number on 0', function() {
        assert.equal(mul(new BN('-100000000000'), new BN('3').div(new BN('4'))).toString(16), '0');
      });
      it('should regress mul big numbers', function() {
        var q = fixtures.dhGroups.p17.q;
        var qs = fixtures.dhGroups.p17.qs;
        var q = new BN(q, 16);
        assert.equal(mul(q, q).toString(16), qs);
      });
    });
  }
  testMethod('.mul()', function(x, y) {
    return BN.prototype.mul.apply(x, [y]);
  });
  testMethod('.mulf()', function(x, y) {
    return BN.prototype.mulf.apply(x, [y]);
  });
  describe('.imul()', function() {
    it('should multiply numbers in-place', function() {
      var a = new BN('abcdef01234567890abcd', 16);
      var b = new BN('deadbeefa551edebabba8', 16);
      var c = a.mul(b);
      assert.equal(a.imul(b).toString(16), c.toString(16));
      var a = new BN('abcdef01234567890abcd214a25123f512361e6d236', 16);
      var b = new BN('deadbeefa551edebabba8121234fd21bac0341324dd', 16);
      var c = a.mul(b);
      assert.equal(a.imul(b).toString(16), c.toString(16));
    });
    it('should multiply by 0', function() {
      var a = new BN('abcdef01234567890abcd', 16);
      var b = new BN('0', 16);
      var c = a.mul(b);
      assert.equal(a.imul(b).toString(16), c.toString(16));
    });
    it('should regress mul big numbers in-place', function() {
      var q = fixtures.dhGroups.p17.q;
      var qs = fixtures.dhGroups.p17.qs;
      var q = new BN(q, 16);
      assert.equal(q.isqr().toString(16), qs);
    });
  });
  describe('.muln()', function() {
    it('should multiply number by small number', function() {
      var a = new BN('abcdef01234567890abcd', 16);
      var b = new BN('dead', 16);
      var c = a.mul(b);
      assert.equal(a.muln(0xdead).toString(16), c.toString(16));
    });
  });
  describe('.pow()', function() {
    it('should raise number to the power', function() {
      var a = new BN('ab', 16);
      var b = new BN('13', 10);
      var c = a.pow(b);
      assert.equal(c.toString(16), '15963da06977df51909c9ba5b');
    });
  });
  describe('.div()', function() {
    it('should divide numbers', function() {
      assert.equal(new BN('10').div(new BN(256)).toString(16), '0');
      assert.equal(new BN('69527932928').div(new BN('16974594')).toString(16), 'fff');
      assert.equal(new BN('-69527932928').div(new BN('16974594')).toString(16), '-fff');
      var b = new BN('39e58a8055b6fb264b75ec8c646509784204ac15a8c24e05babc9729ab9' + 'b055c3a9458e4ce3289560a38e08ba8175a9446ce14e608245ab3a9' + '978a8bd8acaa40', 16);
      var n = new BN('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 16);
      assert.equal(b.div(n).toString(16), n.toString(16));
      assert.equal(new BN('1').div(new BN('-5')).toString(10), '0');
    });
    it('should not fail on regression after moving to _wordDiv', function() {
      var p = new BN('fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', 16);
      var a = new BN('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 16);
      var as = a.sqr();
      assert.equal(as.div(p).toString(16), '39e58a8055b6fb264b75ec8c646509784204ac15a8c24e05babc9729e58090b9');
      var p = new BN('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff', 16);
      var a = new BN('fffffffe00000003fffffffd0000000200000001fffffffe00000002ffffffff' + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
      assert.equal(a.div(p).toString(16), 'ffffffff00000002000000000000000000000001000000000000000000000001');
    });
  });
  describe('.idivn()', function() {
    it('should divide numbers in-place', function() {
      assert.equal(new BN('10', 16).idivn(3).toString(16), '5');
      assert.equal(new BN('12', 16).idivn(3).toString(16), '6');
      assert.equal(new BN('10000000000000000').idivn(3).toString(10), '3333333333333333');
      assert.equal(new BN('100000000000000000000000000000').idivn(3).toString(10), '33333333333333333333333333333');
      var t = new BN(3);
      assert.equal(new BN('12345678901234567890123456', 16).idivn(3).toString(16), new BN('12345678901234567890123456', 16).div(t).toString(16));
    });
  });
  describe('.divRound()', function() {
    it('should divide numbers with rounding', function() {
      assert.equal(new BN(9).divRound(new BN(20)).toString(10), '0');
      assert.equal(new BN(10).divRound(new BN(20)).toString(10), '1');
      assert.equal(new BN(150).divRound(new BN(20)).toString(10), '8');
      assert.equal(new BN(149).divRound(new BN(20)).toString(10), '7');
      assert.equal(new BN(149).divRound(new BN(17)).toString(10), '9');
      assert.equal(new BN(144).divRound(new BN(17)).toString(10), '8');
      assert.equal(new BN(-144).divRound(new BN(17)).toString(10), '-8');
    });
    it('should return 1 on exact division', function() {
      assert.equal(new BN(144).divRound(new BN(144)).toString(10), '1');
    });
  });
  describe('.mod()', function() {
    it('should mod numbers', function() {
      assert.equal(new BN('10').mod(new BN(256)).toString(16), 'a');
      assert.equal(new BN('69527932928').mod(new BN('16974594')).toString(16), '102f302');
      assert.equal(new BN('-178').div(new BN('10')).toString(10), '-17');
      assert.equal(new BN('-178').mod(new BN('10')).toString(10), '-8');
      assert.equal(new BN('-178').div(new BN('-10')).toString(10), '17');
      assert.equal(new BN('-178').mod(new BN('-10')).toString(10), '-8');
      assert.equal(new BN('178').div(new BN('-10')).toString(10), '-17');
      assert.equal(new BN('178').mod(new BN('-10')).toString(10), '8');
      assert.equal(new BN('-4').div(new BN('-3')).toString(10), '1');
      assert.equal(new BN('-4').mod(new BN('-3')).toString(10), '-1');
      assert.equal(new BN('-4').mod(new BN('3')).toString(10), '-1');
      assert.equal(new BN('-4').umod(new BN('-3')).toString(10), '2');
      var p = new BN('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff', 16);
      var a = new BN('fffffffe00000003fffffffd0000000200000001fffffffe00000002ffffffff' + 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16);
      assert.equal(a.mod(p).toString(16), '0');
    });
    it('should properly carry the sign inside division', function() {
      var a = new BN('945304eb96065b2a98b57a48a06ae28d285a71b5', 'hex');
      var b = new BN('fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe', 'hex');
      assert.equal(a.mul(b).mod(a).cmpn(0), 0);
    });
  });
  describe('.modn()', function() {
    it('should act like .mod() on small numbers', function() {
      assert.equal(new BN('10', 16).modn(256).toString(16), '10');
      assert.equal(new BN('100', 16).modn(256).toString(16), '0');
      assert.equal(new BN('1001', 16).modn(256).toString(16), '1');
      assert.equal(new BN('100000000001', 16).modn(256).toString(16), '1');
      assert.equal(new BN('100000000001', 16).modn(257).toString(16), new BN('100000000001', 16).mod(new BN(257)).toString(16));
      assert.equal(new BN('123456789012', 16).modn(3).toString(16), new BN('123456789012', 16).mod(new BN(3)).toString(16));
    });
  });
  describe('.abs()', function() {
    it('should return absolute value', function() {
      assert.equal(new BN(0x1001).abs().toString(), '4097');
      assert.equal(new BN(-0x1001).abs().toString(), '4097');
      assert.equal(new BN('ffffffff', 16).abs().toString(), '4294967295');
    });
  });
  describe('.invm()', function() {
    it('should invert relatively-prime numbers', function() {
      var p = new BN(257);
      var a = new BN(3);
      var b = a.invm(p);
      assert.equal(a.mul(b).mod(p).toString(16), '1');
      var p192 = new BN('fffffffffffffffffffffffffffffffeffffffffffffffff', 16);
      var a = new BN('deadbeef', 16);
      var b = a.invm(p192);
      assert.equal(a.mul(b).mod(p192).toString(16), '1');
      var phi = new BN('872d9b030ba368706b68932cf07a0e0c', 16);
      var e = new BN(65537);
      var d = e.invm(phi);
      assert.equal(e.mul(d).mod(phi).toString(16), '1');
      var a = new BN('5');
      var b = new BN('6');
      var r = a.invm(b);
      assert.equal(r.mul(a).mod(b).toString(16), '1');
    });
  });
  describe('.gcd()', function() {
    it('should return GCD', function() {
      assert.equal(new BN(3).gcd(new BN(2)).toString(16), '1');
      assert.equal(new BN(18).gcd(new BN(12)).toString(16), '6');
      assert.equal(new BN(-18).gcd(new BN(12)).toString(16), '6');
    });
  });
  describe('.egcd()', function() {
    it('should return EGCD', function() {
      assert.equal(new BN(3).egcd(new BN(2)).gcd.toString(16), '1');
      assert.equal(new BN(18).egcd(new BN(12)).gcd.toString(16), '6');
      assert.equal(new BN(-18).egcd(new BN(12)).gcd.toString(16), '6');
    });
  });
  describe('BN.max(a, b)', function() {
    it('should return maximum', function() {
      assert.equal(BN.max(new BN(3), new BN(2)).toString(16), '3');
      assert.equal(BN.max(new BN(2), new BN(3)).toString(16), '3');
      assert.equal(BN.max(new BN(2), new BN(2)).toString(16), '2');
    });
  });
  describe('BN.min(a, b)', function() {
    it('should return minimum', function() {
      assert.equal(BN.min(new BN(3), new BN(2)).toString(16), '2');
      assert.equal(BN.min(new BN(2), new BN(3)).toString(16), '2');
      assert.equal(BN.min(new BN(2), new BN(2)).toString(16), '2');
    });
  });
});
