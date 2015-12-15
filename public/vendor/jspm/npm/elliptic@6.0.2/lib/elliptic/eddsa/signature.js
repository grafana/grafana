/* */ 
'use strict';
var bn = require('bn.js');
var elliptic = require('../../elliptic');
var utils = elliptic.utils;
var assert = utils.assert;
var cachedProperty = utils.cachedProperty;
var parseBytes = utils.parseBytes;
function Signature(eddsa, sig) {
  this.eddsa = eddsa;
  if (typeof sig !== 'object')
    sig = parseBytes(sig);
  if (Array.isArray(sig)) {
    sig = {
      R: sig.slice(0, eddsa.encodingLength),
      S: sig.slice(eddsa.encodingLength)
    };
  }
  assert(sig.R && sig.S, 'Signature without R or S');
  if (eddsa.isPoint(sig.R))
    this._R = sig.R;
  if (sig.S instanceof bn)
    this._S = sig.S;
  this._Rencoded = Array.isArray(sig.R) ? sig.R : sig.Rencoded;
  this._Sencoded = Array.isArray(sig.S) ? sig.S : sig.Sencoded;
}
cachedProperty(Signature, function S() {
  return this.eddsa.decodeInt(this.Sencoded());
});
cachedProperty(Signature, function R() {
  return this.eddsa.decodePoint(this.Rencoded());
});
cachedProperty(Signature, function Rencoded() {
  return this.eddsa.encodePoint(this.R());
});
cachedProperty(Signature, function Sencoded() {
  return this.eddsa.encodeInt(this.S());
});
Signature.prototype.toBytes = function toBytes() {
  return this.Rencoded().concat(this.Sencoded());
};
Signature.prototype.toHex = function toHex() {
  return utils.encode(this.toBytes(), 'hex').toUpperCase();
};
module.exports = Signature;
