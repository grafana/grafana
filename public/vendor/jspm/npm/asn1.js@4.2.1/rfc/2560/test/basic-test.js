/* */ 
(function(Buffer) {
  var assert = require('assert');
  var rfc2560 = require('../index');
  var Buffer = require('buffer').Buffer;
  describe('asn1.js RFC2560', function() {
    it('should decode OCSP response', function() {
      var data = new Buffer('308201d40a0100a08201cd308201c906092b0601050507300101048201ba308201b630' + '819fa216041499e4405f6b145e3e05d9ddd36354fc62b8f700ac180f32303133313133' + '303037343531305a30743072304a300906052b0e03021a050004140226ee2f5fa28108' + '34dacc3380e680ace827f604041499e4405f6b145e3e05d9ddd36354fc62b8f700ac02' + '1100bb4f9a31232b1ba52a0b77af481800588000180f32303133313133303037343531' + '305aa011180f32303133313230343037343531305a300d06092a864886f70d01010505' + '00038201010027813333c9b46845dfe3d0cb6b19c03929cdfc9181c1ce823929bb911a' + 'd9de05721790fcccbab43f9fbdec1217ab8023156d07bbcc3555f25e9e472fbbb5e019' + '2835efcdc71b3dbc5e5c4c5939fc7a610fc6521d4ed7d2b685a812fa1a3a129ea87873' + '972be3be54618ba4a4d96090d7f9aaa5f70d4f07cf5cf3611d8a7b3adafe0b319459ed' + '40d456773d5f45f04c773711d86cc41d274f771a31c10d30cd6f846b587524bfab2445' + '4bbb4535cff46f6b341e50f26a242dd78e246c8dea0e2fabcac9582e000c138766f536' + 'd7f7bab81247c294454e62b710b07126de4e09685818f694df5783eb66f384ce5977f1' + '2721ff38c709f3ec580d22ff40818dd17f', 'hex');
      var res = rfc2560.OCSPResponse.decode(data, 'der');
      assert.equal(res.responseStatus, 'successful');
      assert.equal(res.responseBytes.responseType, 'id-pkix-ocsp-basic');
      var basic = rfc2560.BasicOCSPResponse.decode(res.responseBytes.response, 'der');
      assert.equal(basic.tbsResponseData.version, 'v1');
      assert.equal(basic.tbsResponseData.producedAt, 1385797510000);
    });
    it('should encode/decode OCSP response', function() {
      var encoded = rfc2560.OCSPResponse.encode({
        responseStatus: 'malformed_request',
        responseBytes: {
          responseType: 'id-pkix-ocsp-basic',
          response: 'random-string'
        }
      }, 'der');
      var decoded = rfc2560.OCSPResponse.decode(encoded, 'der');
      assert.equal(decoded.responseStatus, 'malformed_request');
      assert.equal(decoded.responseBytes.responseType, 'id-pkix-ocsp-basic');
      assert.equal(decoded.responseBytes.response.toString(), 'random-string');
    });
  });
})(require('buffer').Buffer);
