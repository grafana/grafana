/* */ 
var baseToString = require('../internal/baseToString'),
    escapeHtmlChar = require('../internal/escapeHtmlChar');
var reUnescapedHtml = /[&<>"'`]/g,
    reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
function escape(string) {
  string = baseToString(string);
  return (string && reHasUnescapedHtml.test(string)) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
}
module.exports = escape;
