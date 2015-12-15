/* */ 
(function(Buffer) {
  'use strict';
  exports['RSA-SHA224'] = exports.sha224WithRSAEncryption = {
    sign: 'rsa',
    hash: 'sha224',
    id: new Buffer('302d300d06096086480165030402040500041c', 'hex')
  };
  exports['RSA-SHA256'] = exports.sha256WithRSAEncryption = {
    sign: 'rsa',
    hash: 'sha256',
    id: new Buffer('3031300d060960864801650304020105000420', 'hex')
  };
  exports['RSA-SHA384'] = exports.sha384WithRSAEncryption = {
    sign: 'rsa',
    hash: 'sha384',
    id: new Buffer('3041300d060960864801650304020205000430', 'hex')
  };
  exports['RSA-SHA512'] = exports.sha512WithRSAEncryption = {
    sign: 'rsa',
    hash: 'sha512',
    id: new Buffer('3051300d060960864801650304020305000440', 'hex')
  };
  exports['RSA-SHA1'] = {
    sign: 'rsa',
    hash: 'sha1',
    id: new Buffer('3021300906052b0e03021a05000414', 'hex')
  };
  exports['ecdsa-with-SHA1'] = {
    sign: 'ecdsa',
    hash: 'sha1',
    id: new Buffer('', 'hex')
  };
  exports.DSA = exports['DSA-SHA1'] = exports['DSA-SHA'] = {
    sign: 'dsa',
    hash: 'sha1',
    id: new Buffer('', 'hex')
  };
  exports['DSA-SHA224'] = exports['DSA-WITH-SHA224'] = {
    sign: 'dsa',
    hash: 'sha224',
    id: new Buffer('', 'hex')
  };
  exports['DSA-SHA256'] = exports['DSA-WITH-SHA256'] = {
    sign: 'dsa',
    hash: 'sha256',
    id: new Buffer('', 'hex')
  };
  exports['DSA-SHA384'] = exports['DSA-WITH-SHA384'] = {
    sign: 'dsa',
    hash: 'sha384',
    id: new Buffer('', 'hex')
  };
  exports['DSA-SHA512'] = exports['DSA-WITH-SHA512'] = {
    sign: 'dsa',
    hash: 'sha512',
    id: new Buffer('', 'hex')
  };
  exports['DSA-RIPEMD160'] = {
    sign: 'dsa',
    hash: 'rmd160',
    id: new Buffer('', 'hex')
  };
  exports['RSA-RIPEMD160'] = exports.ripemd160WithRSA = {
    sign: 'rsa',
    hash: 'rmd160',
    id: new Buffer('3021300906052b2403020105000414', 'hex')
  };
  exports['RSA-MD5'] = exports.md5WithRSAEncryption = {
    sign: 'rsa',
    hash: 'md5',
    id: new Buffer('3020300c06082a864886f70d020505000410', 'hex')
  };
})(require('buffer').Buffer);
