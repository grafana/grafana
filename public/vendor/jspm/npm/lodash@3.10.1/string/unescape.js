/* */ 
var baseToString = require('../internal/baseToString'),
    unescapeHtmlChar = require('../internal/unescapeHtmlChar');
var reEscapedHtml = /&(?:amp|lt|gt|quot|#39|#96);/g,
    reHasEscapedHtml = RegExp(reEscapedHtml.source);
function unescape(string) {
  string = baseToString(string);
  return (string && reHasEscapedHtml.test(string)) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
}
module.exports = unescape;
