/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var promise_1 = require('../../facade/promise');
var lang_1 = require('../../facade/lang');
var xhr_1 = require('../../compiler/xhr');
var XHRImpl = (function(_super) {
  __extends(XHRImpl, _super);
  function XHRImpl() {
    _super.apply(this, arguments);
  }
  XHRImpl.prototype.get = function(url) {
    var completer = promise_1.PromiseWrapper.completer();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    xhr.onload = function() {
      var response = lang_1.isPresent(xhr.response) ? xhr.response : xhr.responseText;
      var status = xhr.status === 1223 ? 204 : xhr.status;
      if (status === 0) {
        status = response ? 200 : 0;
      }
      if (200 <= status && status <= 300) {
        completer.resolve(response);
      } else {
        completer.reject("Failed to load " + url, null);
      }
    };
    xhr.onerror = function() {
      completer.reject("Failed to load " + url, null);
    };
    xhr.send();
    return completer.promise;
  };
  return XHRImpl;
})(xhr_1.XHR);
exports.XHRImpl = XHRImpl;
