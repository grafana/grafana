/* */ 
try {
  var asn1 = require('asn1.js');
  var rfc3280 = require('asn1.js-rfc3280');
} catch (e) {
  var asn1 = require('../' + '..');
  var rfc3280 = require('../' + '3280');
}

var OCSPRequest = asn1.define('OCSPRequest', function() {
  this.seq().obj(
    this.key('tbsRequest').use(TBSRequest),
    this.key('optionalSignature').optional().explicit(0).use(Signature)
  );
});
exports.OCSPRequest = OCSPRequest;

var TBSRequest = asn1.define('TBSRequest', function() {
  this.seq().obj(
    this.key('version').def('v1').explicit(0).use(rfc3280.Version),
    this.key('requestorName').optional().explicit(1).use(rfc3280.GeneralName),
    this.key('requestList').seqof(Request),
    this.key('requestExtensions').optional().explicit(2).use(rfc3280.Extensions)
  );
});
exports.TBSRequest = TBSRequest;

var Signature = asn1.define('Signature', function() {
  this.seq().obj(
    this.key('signatureAlgorithm').use(rfc3280.AlgorithmIdentifier),
    this.key('signature').bitstr(),
    this.key('certs').optional().explicit(0).seqof(rfc3280.Certificate)
  );
});
exports.Signature = Signature;

var Request = asn1.define('Request', function() {
  this.seq().obj(
    this.key('reqCert').use(CertID),
    this.key('singleRequestExtensions').optional().explicit(0).use(
      rfc3280.Extensions)
  );
});
exports.Request = Request;

var OCSPResponse = asn1.define('OCSPResponse', function() {
  this.seq().obj(
    this.key('responseStatus').use(ResponseStatus),
    this.key('responseBytes').optional().explicit(0).seq().obj(
        this.key('responseType').objid({
          '1 3 6 1 5 5 7 48 1 1': 'id-pkix-ocsp-basic'
        }),
        this.key('response').octstr()
    )
  );
});
exports.OCSPResponse = OCSPResponse;

var ResponseStatus = asn1.define('ResponseStatus', function() {
  this.enum({
    0: 'successful',
    1: 'malformed_request',
    2: 'internal_error',
    3: 'try_later',
    5: 'sig_required',
    6: 'unauthorized'
  });
});
exports.ResponseStatus = ResponseStatus;

var BasicOCSPResponse = asn1.define('BasicOCSPResponse', function() {
  this.seq().obj(
    this.key('tbsResponseData').use(ResponseData),
    this.key('signatureAlgorithm').use(rfc3280.AlgorithmIdentifier),
    this.key('signature').bitstr(),
    this.key('certs').optional().explicit(0).seqof(rfc3280.Certificate)
  );
});
exports.BasicOCSPResponse = BasicOCSPResponse;

var ResponseData = asn1.define('ResponseData', function() {
  this.seq().obj(
    this.key('version').def('v1').explicit(0).use(rfc3280.Version),
    this.key('responderID').use(ResponderID),
    this.key('producedAt').gentime(),
    this.key('responses').seqof(SingleResponse),
    this.key('responseExtensions').optional().explicit(0)
        .use(rfc3280.Extensions)
  );
});
exports.ResponseData = ResponseData;

var ResponderID = asn1.define('ResponderId', function() {
  this.choice({
    byName: this.explicit(1).use(rfc3280.Name),
    byKey: this.explicit(2).use(KeyHash)
  });
});
exports.ResponderID = ResponderID;

var KeyHash = asn1.define('KeyHash', function() {
  this.octstr();
});
exports.KeyHash = KeyHash;

var SingleResponse = asn1.define('SingleResponse', function() {
  this.seq().obj(
    this.key('certId').use(CertID),
    this.key('certStatus').use(CertStatus),
    this.key('thisUpdate').gentime(),
    this.key('nextUpdate').optional().explicit(0).gentime(),
    this.key('singleExtensions').optional().explicit(1).use(rfc3280.Extensions)
  );
});
exports.SingleResponse = SingleResponse;

var CertStatus = asn1.define('CertStatus', function() {
  this.choice({
    good: this.implicit(0).null_(),
    revoked: this.implicit(1).use(RevokedInfo),
    unknown: this.implicit(2).null_()
  });
});
exports.CertStatus = CertStatus;

var RevokedInfo = asn1.define('RevokedInfo', function() {
  this.seq().obj(
    this.key('revocationTime').gentime(),
    this.key('revocationReason').optional().explicit(0).use(rfc3280.CRLReason)
  );
});
exports.RevokedInfo = RevokedInfo;

var CertID = asn1.define('CertID', function() {
  this.seq().obj(
    this.key('hashAlgorithm').use(rfc3280.AlgorithmIdentifier),
    this.key('issuerNameHash').octstr(),
    this.key('issuerKeyHash').octstr(),
    this.key('serialNumber').use(rfc3280.CertificateSerialNumber)
  );
});
exports.CertID = CertID;

var Nonce = asn1.define('Nonce', function() {
  this.octstr();
});
exports.Nonce = Nonce;

exports['id-pkix-ocsp'] = [ 1, 3, 6, 1, 5, 5, 7, 48, 1 ];
exports['id-pkix-ocsp-nonce'] = [ 1, 3, 6, 1, 5, 5, 7, 48, 1, 2 ];
