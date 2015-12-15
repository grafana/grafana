/* */ 
var asn1 = exports;
asn1.bignum = require('bn.js');
asn1.define = require('./asn1/api').define;
asn1.base = require('./asn1/base/index');
asn1.constants = require('./asn1/constants/index');
asn1.decoders = require('./asn1/decoders/index');
asn1.encoders = require('./asn1/encoders/index');
