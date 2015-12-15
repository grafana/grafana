/* */ 
(function(Buffer) {
  var assert = require('assert');
  var BN = require('../lib/bn').BN;
  var fixtures = require('./fixtures');
  describe('BN.js/Reduction context', function() {
    function testMethod(name, fn) {
      describe(name + ' method', function() {
        it('should support add, iadd, sub, isub operations', function() {
          var p = new BN(257);
          var m = fn(p);
          var a = new BN(123).toRed(m);
          var b = new BN(231).toRed(m);
          assert.equal(a.redAdd(b).fromRed().toString(10), '97');
          assert.equal(a.redSub(b).fromRed().toString(10), '149');
          assert.equal(b.redSub(a).fromRed().toString(10), '108');
          assert.equal(a.clone().redIAdd(b).fromRed().toString(10), '97');
          assert.equal(a.clone().redISub(b).fromRed().toString(10), '149');
          assert.equal(b.clone().redISub(a).fromRed().toString(10), '108');
        });
        it('should support pow and mul operations', function() {
          var p192 = new BN('fffffffffffffffffffffffffffffffeffffffffffffffff', 16);
          var m = fn(p192);
          var a = new BN(123);
          var b = new BN(231);
          var c = a.toRed(m).redMul(b.toRed(m)).fromRed();
          assert(c.cmp(a.mul(b).mod(p192)) === 0);
          assert.equal(a.toRed(m).redPow(new BN(3)).fromRed().cmp(a.sqr().mul(a)), 0);
          assert.equal(a.toRed(m).redPow(new BN(4)).fromRed().cmp(a.sqr().sqr()), 0);
          assert.equal(a.toRed(m).redPow(new BN(8)).fromRed().cmp(a.sqr().sqr().sqr()), 0);
          assert.equal(a.toRed(m).redPow(new BN(9)).fromRed().cmp(a.sqr().sqr().sqr().mul(a)), 0);
          assert.equal(a.toRed(m).redPow(new BN(17)).fromRed().cmp(a.sqr().sqr().sqr().sqr().mul(a)), 0);
          assert.equal(a.toRed(m).redPow(new BN('deadbeefabbadead', 16)).fromRed().toString(16), '3aa0e7e304e320b68ef61592bcb00341866d6fa66e11a4d6');
        });
        it('should sqrtm numbers', function() {
          var p = new BN(263);
          var m = fn(p);
          var q = new BN(11).toRed(m);
          var qr = q.redSqrt(true, p);
          assert.equal(qr.redSqr().cmp(q), 0);
          var qr = q.redSqrt(false, p);
          assert.equal(qr.redSqr().cmp(q), 0);
          var p = new BN('fffffffffffffffffffffffffffffffeffffffffffffffff', 16);
          var m = fn(p);
          var q = new BN(13).toRed(m);
          var qr = q.redSqrt(true, p);
          assert.equal(qr.redSqr().cmp(q), 0);
          var qr = q.redSqrt(false, p);
          assert.equal(qr.redSqr().cmp(q), 0);
          var p = new BN(13);
          var m = fn(p);
          var q = new BN(10).toRed(m);
          assert.equal(q.redSqrt().fromRed().toString(10), '7');
        });
        it('should invm numbers', function() {
          var p = new BN(257);
          var m = fn(p);
          var a = new BN(3).toRed(m);
          var b = a.redInvm();
          assert.equal(a.redMul(b).fromRed().toString(16), '1');
        });
        it('should invm numbers (regression)', function() {
          var p = new BN('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff', 16);
          var a = new BN('e1d969b8192fbac73ea5b7921896d6a2263d4d4077bb8e5055361d1f7f8163f3', 16);
          var m = fn(p);
          var a = a.toRed(m);
          assert.equal(a.redInvm().fromRed().negative, 0);
        });
        it('should imul numbers', function() {
          var p = new BN('fffffffffffffffffffffffffffffffeffffffffffffffff', 16);
          var m = fn(p);
          var a = new BN('deadbeefabbadead', 16);
          var b = new BN('abbadeadbeefdead', 16);
          var c = a.mul(b).mod(p);
          assert.equal(a.toRed(m).redIMul(b.toRed(m)).fromRed().toString(16), c.toString(16));
        });
        it('should pow(base, 0) == 1', function() {
          var base = new BN(256).toRed(BN.red('k256'));
          var exponent = new BN(0);
          var result = base.redPow(exponent);
          assert.equal(result.toString(), '1');
        });
        it('should reduce when converting to red', function() {
          var p = new BN(257);
          var m = fn(p);
          var a = new BN(5).toRed(m);
          assert.doesNotThrow(function() {
            var b = a.redISub(new BN(512).toRed(m));
            b.redISub(new BN(512).toRed(m));
          });
        });
      });
    }
    testMethod('Plain', BN.red);
    testMethod('Montgomery', BN.mont);
    describe('Pseudo-Mersenne Primes', function() {
      it('should reduce numbers mod k256', function() {
        var p = BN._prime('k256');
        assert.equal(p.ireduce(new BN(0xdead)).toString(16), 'dead');
        assert.equal(p.ireduce(new BN('deadbeef', 16)).toString(16), 'deadbeef');
        var num = new BN('fedcba9876543210fedcba9876543210dead' + 'fedcba9876543210fedcba9876543210dead', 16);
        var exp = num.mod(p.p).toString(16);
        assert.equal(p.ireduce(num).toString(16), exp);
        var regr = new BN('f7e46df64c1815962bf7bc9c56128798' + '3f4fcef9cb1979573163b477eab93959' + '335dfb29ef07a4d835d22aa3b6797760' + '70a8b8f59ba73d56d01a79af9', 16);
        var exp = regr.mod(p.p).toString(16);
        assert.equal(p.ireduce(regr).toString(16), exp);
      });
      it('should not fail to invm number mod k256', function() {
        var regr2 = new BN('6c150c4aa9a8cf1934485d40674d4a7cd494675537bda36d49405c5d2c6f496f', 16);
        regr2 = regr2.toRed(BN.red('k256'));
        assert.equal(regr2.redInvm().redMul(regr2).fromRed().cmpn(1), 0);
      });
      it('should correctly square the number', function() {
        var p = BN._prime('k256').p;
        var red = BN.red('k256');
        var n = new BN('9cd8cb48c3281596139f147c1364a3ed' + 'e88d3f310fdb0eb98c924e599ca1b3c9', 16);
        var expected = n.sqr().mod(p);
        var actual = n.toRed(red).redSqr().fromRed();
        assert.equal(actual.toString(16), expected.toString(16));
      });
    });
    it('should avoid 4.1.0 regresion', function() {
      function bits2int(obits, q) {
        var bits = new BN(obits);
        var shift = (obits.length << 3) - q.bitLength();
        if (shift > 0) {
          bits.ishrn(shift);
        }
        return bits;
      }
      var t = new Buffer('aff1651e4cd6036d57aa8b2a05ccf1a9d5a40166340ecbbdc55' + 'be10b568aa0aa3d05ce9a2fcec9df8ed018e29683c6051cb83e' + '46ce31ba4edb045356a8d0d80b', 'hex');
      var g = new BN('5c7ff6b06f8f143fe8288433493e4769c4d988ace5be25a0e24809670' + '716c613d7b0cee6932f8faa7c44d2cb24523da53fbe4f6ec3595892d1' + 'aa58c4328a06c46a15662e7eaa703a1decf8bbb2d05dbe2eb956c142a' + '338661d10461c0d135472085057f3494309ffa73c611f78b32adbb574' + '0c361c9f35be90997db2014e2ef5aa61782f52abeb8bd6432c4dd097b' + 'c5423b285dafb60dc364e8161f4a2a35aca3a10b1c4d203cc76a470a3' + '3afdcbdd92959859abd8b56e1725252d78eac66e71ba9ae3f1dd24871' + '99874393cd4d832186800654760e1e34c09e4d155179f9ec0dc4473f9' + '96bdce6eed1cabed8b6f116f7ad9cf505df0f998e34ab27514b0ffe7', 16);
      var p = new BN('9db6fb5951b66bb6fe1e140f1d2ce5502374161fd6538df1648218642' + 'f0b5c48c8f7a41aadfa187324b87674fa1822b00f1ecf8136943d7c55' + '757264e5a1a44ffe012e9936e00c1d3e9310b01c7d179805d3058b2a9' + 'f4bb6f9716bfe6117c6b5b3cc4d9be341104ad4a80ad6c94e005f4b99' + '3e14f091eb51743bf33050c38de235567e1b34c3d6a5c0ceaa1a0f368' + '213c3d19843d0b4b09dcb9fc72d39c8de41f1bf14d4bb4563ca283716' + '21cad3324b6a2d392145bebfac748805236f5ca2fe92b871cd8f9c36d' + '3292b5509ca8caa77a2adfc7bfd77dda6f71125a7456fea153e433256' + 'a2261c6a06ed3693797e7995fad5aabbcfbe3eda2741e375404ae25b', 16);
      var q = new BN('f2c3119374ce76c9356990b465374a17f23f9ed35089bd969f61c6dde' + '9998c1f', 16);
      var k = bits2int(t, q);
      var expectedR = '89ec4bb1400eccff8e7d9aa515cd1de7803f2daff09693ee7fd1353e' + '90a68307';
      var r = g.toRed(BN.mont(p)).redPow(k).fromRed().mod(q);
      assert.equal(r.toString(16), expectedR);
    });
  });
})(require('buffer').Buffer);
