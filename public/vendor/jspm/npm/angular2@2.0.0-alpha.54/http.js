/* */ 
'use strict';
var core_1 = require('./core');
var http_1 = require('./src/http/http');
var xhr_backend_1 = require('./src/http/backends/xhr_backend');
var jsonp_backend_1 = require('./src/http/backends/jsonp_backend');
var browser_xhr_1 = require('./src/http/backends/browser_xhr');
var browser_jsonp_1 = require('./src/http/backends/browser_jsonp');
var base_request_options_1 = require('./src/http/base_request_options');
var base_response_options_1 = require('./src/http/base_response_options');
var static_request_1 = require('./src/http/static_request');
exports.Request = static_request_1.Request;
var static_response_1 = require('./src/http/static_response');
exports.Response = static_response_1.Response;
var interfaces_1 = require('./src/http/interfaces');
exports.Connection = interfaces_1.Connection;
exports.ConnectionBackend = interfaces_1.ConnectionBackend;
var browser_xhr_2 = require('./src/http/backends/browser_xhr');
exports.BrowserXhr = browser_xhr_2.BrowserXhr;
var base_request_options_2 = require('./src/http/base_request_options');
exports.BaseRequestOptions = base_request_options_2.BaseRequestOptions;
exports.RequestOptions = base_request_options_2.RequestOptions;
var base_response_options_2 = require('./src/http/base_response_options');
exports.BaseResponseOptions = base_response_options_2.BaseResponseOptions;
exports.ResponseOptions = base_response_options_2.ResponseOptions;
var xhr_backend_2 = require('./src/http/backends/xhr_backend');
exports.XHRBackend = xhr_backend_2.XHRBackend;
exports.XHRConnection = xhr_backend_2.XHRConnection;
var jsonp_backend_2 = require('./src/http/backends/jsonp_backend');
exports.JSONPBackend = jsonp_backend_2.JSONPBackend;
exports.JSONPConnection = jsonp_backend_2.JSONPConnection;
var http_2 = require('./src/http/http');
exports.Http = http_2.Http;
exports.Jsonp = http_2.Jsonp;
var headers_1 = require('./src/http/headers');
exports.Headers = headers_1.Headers;
var enums_1 = require('./src/http/enums');
exports.ResponseType = enums_1.ResponseType;
exports.ReadyState = enums_1.ReadyState;
exports.RequestMethod = enums_1.RequestMethod;
var url_search_params_1 = require('./src/http/url_search_params');
exports.URLSearchParams = url_search_params_1.URLSearchParams;
exports.HTTP_PROVIDERS = [core_1.provide(http_1.Http, {
  useFactory: function(xhrBackend, requestOptions) {
    return new http_1.Http(xhrBackend, requestOptions);
  },
  deps: [xhr_backend_1.XHRBackend, base_request_options_1.RequestOptions]
}), browser_xhr_1.BrowserXhr, core_1.provide(base_request_options_1.RequestOptions, {useClass: base_request_options_1.BaseRequestOptions}), core_1.provide(base_response_options_1.ResponseOptions, {useClass: base_response_options_1.BaseResponseOptions}), xhr_backend_1.XHRBackend];
exports.HTTP_BINDINGS = exports.HTTP_PROVIDERS;
exports.JSONP_PROVIDERS = [core_1.provide(http_1.Jsonp, {
  useFactory: function(jsonpBackend, requestOptions) {
    return new http_1.Jsonp(jsonpBackend, requestOptions);
  },
  deps: [jsonp_backend_1.JSONPBackend, base_request_options_1.RequestOptions]
}), browser_jsonp_1.BrowserJsonp, core_1.provide(base_request_options_1.RequestOptions, {useClass: base_request_options_1.BaseRequestOptions}), core_1.provide(base_response_options_1.ResponseOptions, {useClass: base_response_options_1.BaseResponseOptions}), core_1.provide(jsonp_backend_1.JSONPBackend, {useClass: jsonp_backend_1.JSONPBackend_})];
exports.JSON_BINDINGS = exports.JSONP_PROVIDERS;
