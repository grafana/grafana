/* */ 
'use strict';
var headers_1 = require('./headers');
var http_utils_1 = require('./http_utils');
var lang_1 = require('../facade/lang');
var Request = (function() {
  function Request(requestOptions) {
    var url = requestOptions.url;
    this.url = requestOptions.url;
    if (lang_1.isPresent(requestOptions.search)) {
      var search = requestOptions.search.toString();
      if (search.length > 0) {
        var prefix = '?';
        if (lang_1.StringWrapper.contains(this.url, '?')) {
          prefix = (this.url[this.url.length - 1] == '&') ? '' : '&';
        }
        this.url = url + prefix + search;
      }
    }
    this._body = requestOptions.body;
    this.method = http_utils_1.normalizeMethodName(requestOptions.method);
    this.headers = new headers_1.Headers(requestOptions.headers);
  }
  Request.prototype.text = function() {
    return lang_1.isPresent(this._body) ? this._body.toString() : '';
  };
  return Request;
})();
exports.Request = Request;
