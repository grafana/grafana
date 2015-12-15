/* */ 
var baseToString = require('../internal/baseToString'),
    escapeRegExpChar = require('../internal/escapeRegExpChar');
var reRegExpChars = /^[:!,]|[\\^$.*+?()[\]{}|\/]|(^[0-9a-fA-Fnrtuvx])|([\n\r\u2028\u2029])/g,
    reHasRegExpChars = RegExp(reRegExpChars.source);
function escapeRegExp(string) {
  string = baseToString(string);
  return (string && reHasRegExpChars.test(string)) ? string.replace(reRegExpChars, escapeRegExpChar) : (string || '(?:)');
}
module.exports = escapeRegExp;
