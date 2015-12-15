/* */ 
'use strict';
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var enums_1 = require('../enums');
var static_response_1 = require('../static_response');
var headers_1 = require('../headers');
var base_response_options_1 = require('../base_response_options');
var core_1 = require('../../../core');
var browser_xhr_1 = require('./browser_xhr');
var lang_1 = require('../../facade/lang');
var Observable_1 = require('rxjs/Observable');
var http_utils_1 = require('../http_utils');
var XHRConnection = (function() {
  function XHRConnection(req, browserXHR, baseResponseOptions) {
    var _this = this;
    this.request = req;
    this.response = new Observable_1.Observable(function(responseObserver) {
      var _xhr = browserXHR.build();
      _xhr.open(enums_1.RequestMethod[req.method].toUpperCase(), req.url);
      var onLoad = function() {
        var body = lang_1.isPresent(_xhr.response) ? _xhr.response : _xhr.responseText;
        var headers = headers_1.Headers.fromResponseHeaderString(_xhr.getAllResponseHeaders());
        var url = http_utils_1.getResponseURL(_xhr);
        var status = _xhr.status === 1223 ? 204 : _xhr.status;
        if (status === 0) {
          status = body ? 200 : 0;
        }
        var responseOptions = new base_response_options_1.ResponseOptions({
          body: body,
          status: status,
          headers: headers,
          url: url
        });
        if (lang_1.isPresent(baseResponseOptions)) {
          responseOptions = baseResponseOptions.merge(responseOptions);
        }
        var response = new static_response_1.Response(responseOptions);
        if (http_utils_1.isSuccess(status)) {
          responseObserver.next(response);
          responseObserver.complete();
          return;
        }
        responseObserver.error(response);
      };
      var onError = function(err) {
        var responseOptions = new base_response_options_1.ResponseOptions({
          body: err,
          type: enums_1.ResponseType.Error
        });
        if (lang_1.isPresent(baseResponseOptions)) {
          responseOptions = baseResponseOptions.merge(responseOptions);
        }
        responseObserver.error(new static_response_1.Response(responseOptions));
      };
      if (lang_1.isPresent(req.headers)) {
        req.headers.forEach(function(values, name) {
          return _xhr.setRequestHeader(name, values.join(','));
        });
      }
      _xhr.addEventListener('load', onLoad);
      _xhr.addEventListener('error', onError);
      _xhr.send(_this.request.text());
      return function() {
        _xhr.removeEventListener('load', onLoad);
        _xhr.removeEventListener('error', onError);
        _xhr.abort();
      };
    });
  }
  return XHRConnection;
})();
exports.XHRConnection = XHRConnection;
var XHRBackend = (function() {
  function XHRBackend(_browserXHR, _baseResponseOptions) {
    this._browserXHR = _browserXHR;
    this._baseResponseOptions = _baseResponseOptions;
  }
  XHRBackend.prototype.createConnection = function(request) {
    return new XHRConnection(request, this._browserXHR, this._baseResponseOptions);
  };
  XHRBackend = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [browser_xhr_1.BrowserXhr, base_response_options_1.ResponseOptions])], XHRBackend);
  return XHRBackend;
})();
exports.XHRBackend = XHRBackend;
