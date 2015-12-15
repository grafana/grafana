/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var StyleWithImports = (function() {
  function StyleWithImports(style, styleUrls) {
    this.style = style;
    this.styleUrls = styleUrls;
  }
  return StyleWithImports;
})();
exports.StyleWithImports = StyleWithImports;
function isStyleUrlResolvable(url) {
  if (lang_1.isBlank(url) || url.length === 0 || url[0] == '/')
    return false;
  var schemeMatch = lang_1.RegExpWrapper.firstMatch(_urlWithSchemaRe, url);
  return lang_1.isBlank(schemeMatch) || schemeMatch[1] == 'package' || schemeMatch[1] == 'asset';
}
exports.isStyleUrlResolvable = isStyleUrlResolvable;
function extractStyleUrls(resolver, baseUrl, cssText) {
  var foundUrls = [];
  var modifiedCssText = lang_1.StringWrapper.replaceAllMapped(cssText, _cssImportRe, function(m) {
    var url = lang_1.isPresent(m[1]) ? m[1] : m[2];
    if (!isStyleUrlResolvable(url)) {
      return m[0];
    }
    foundUrls.push(resolver.resolve(baseUrl, url));
    return '';
  });
  return new StyleWithImports(modifiedCssText, foundUrls);
}
exports.extractStyleUrls = extractStyleUrls;
var _cssImportRe = /@import\s+(?:url\()?\s*(?:(?:['"]([^'"]*))|([^;\)\s]*))[^;]*;?/g;
var _urlWithSchemaRe = /^([a-zA-Z\-\+\.]+):/g;
