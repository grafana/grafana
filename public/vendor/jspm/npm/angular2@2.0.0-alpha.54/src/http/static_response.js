/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var exceptions_1 = require('../facade/exceptions');
var http_utils_1 = require('./http_utils');
var Response = (function() {
  function Response(responseOptions) {
    this._body = responseOptions.body;
    this.status = responseOptions.status;
    this.statusText = responseOptions.statusText;
    this.headers = responseOptions.headers;
    this.type = responseOptions.type;
    this.url = responseOptions.url;
  }
  Response.prototype.blob = function() {
    throw new exceptions_1.BaseException('"blob()" method not implemented on Response superclass');
  };
  Response.prototype.json = function() {
    var jsonResponse;
    if (http_utils_1.isJsObject(this._body)) {
      jsonResponse = this._body;
    } else if (lang_1.isString(this._body)) {
      jsonResponse = lang_1.Json.parse(this._body);
    }
    return jsonResponse;
  };
  Response.prototype.text = function() {
    return this._body.toString();
  };
  Response.prototype.arrayBuffer = function() {
    throw new exceptions_1.BaseException('"arrayBuffer()" method not implemented on Response superclass');
  };
  return Response;
})();
exports.Response = Response;
