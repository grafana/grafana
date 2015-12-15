/* */ 
(function(Buffer) {
  var assert = require('assert');
  var asn1 = require('../lib/asn1');
  var Buffer = require('buffer').Buffer;
  describe('asn1.js DER decoder', function() {
    it('should propagate implicit tag', function() {
      var B = asn1.define('B', function() {
        this.seq().obj(this.key('b').octstr());
      });
      var A = asn1.define('Bug', function() {
        this.seq().obj(this.key('a').implicit(0).use(B));
      });
      var out = A.decode(new Buffer('300720050403313233', 'hex'), 'der');
      assert.equal(out.a.b.toString(), '123');
    });
    it('should decode optional tag to undefined key', function() {
      var A = asn1.define('A', function() {
        this.seq().obj(this.key('key').bool(), this.optional().key('opt').bool());
      });
      var out = A.decode(new Buffer('30030101ff', 'hex'), 'der');
      assert.deepEqual(out, {'key': true});
    });
    it('should decode optional tag to default value', function() {
      var A = asn1.define('A', function() {
        this.seq().obj(this.key('key').bool(), this.optional().key('opt').octstr().def('default'));
      });
      var out = A.decode(new Buffer('30030101ff', 'hex'), 'der');
      assert.deepEqual(out, {
        'key': true,
        'opt': 'default'
      });
    });
    function test(name, model, inputHex, expected) {
      it(name, function() {
        var M = asn1.define('Model', model);
        var decoded = M.decode(new Buffer(inputHex, 'hex'), 'der');
        assert.deepEqual(decoded, expected);
      });
    }
    test('should decode choice', function() {
      this.choice({apple: this.bool()});
    }, '0101ff', {
      'type': 'apple',
      'value': true
    });
    it('should decode optional and use', function() {
      var B = asn1.define('B', function() {
        this.int();
      });
      var A = asn1.define('A', function() {
        this.optional().use(B);
      });
      var out = A.decode(new Buffer('020101', 'hex'), 'der');
      assert.equal(out.toString(10), '1');
    });
    test('should decode indefinite length', function() {
      this.seq().obj(this.key('key').bool());
    }, '30800101ff0000', {'key': true});
    test('should decode bmpstr', function() {
      this.bmpstr();
    }, '1e26004300650072007400690066006900630061' + '0074006500540065006d0070006c006100740065', 'CertificateTemplate');
    test('should decode bmpstr with cyrillic chars', function() {
      this.bmpstr();
    }, '1e0c041f04400438043204350442', 'Привет');
  });
})(require('buffer').Buffer);
