/* */ 
(function(Buffer) {
  var assert = require('assert');
  var asn1 = require('../lib/asn1');
  var BN = require('bn.js');
  var Buffer = require('buffer').Buffer;
  describe('asn1.js PEM encoder/decoder', function() {
    var model = asn1.define('Model', function() {
      this.seq().obj(this.key('a').int(), this.key('b').bitstr(), this.key('c').int());
    });
    var hundred = new Buffer(100);
    hundred.fill('A');
    it('should encode PEM', function() {
      var out = model.encode({
        a: new BN(123),
        b: {
          data: hundred,
          unused: 0
        },
        c: new BN(456)
      }, 'pem', {label: 'MODEL'});
      var expected = '-----BEGIN MODEL-----\n' + 'MG4CAXsDZQBBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB\n' + 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB\n' + 'QUFBQUFBQUFBQUFBAgIByA==\n' + '-----END MODEL-----';
      assert.equal(out, expected);
    });
    it('should decode PEM', function() {
      var expected = '-----BEGIN MODEL-----\n' + 'MG4CAXsDZQBBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB\n' + 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB\n' + 'QUFBQUFBQUFBQUFBAgIByA==\n' + '-----END MODEL-----';
      var out = model.decode(expected, 'pem', {label: 'MODEL'});
      assert.equal(out.a.toString(), '123');
      assert.equal(out.b.data.toString(), hundred.toString());
      assert.equal(out.c.toString(), '456');
    });
  });
})(require('buffer').Buffer);
