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
var core_1 = require('../../../core');
var lang_1 = require('../../facade/lang');
var _nextRequestId = 0;
exports.JSONP_HOME = '__ng_jsonp__';
var _jsonpConnections = null;
function _getJsonpConnections() {
  if (_jsonpConnections === null) {
    _jsonpConnections = lang_1.global[exports.JSONP_HOME] = {};
  }
  return _jsonpConnections;
}
var BrowserJsonp = (function() {
  function BrowserJsonp() {}
  BrowserJsonp.prototype.build = function(url) {
    var node = document.createElement('script');
    node.src = url;
    return node;
  };
  BrowserJsonp.prototype.nextRequestID = function() {
    return "__req" + _nextRequestId++;
  };
  BrowserJsonp.prototype.requestCallback = function(id) {
    return exports.JSONP_HOME + "." + id + ".finished";
  };
  BrowserJsonp.prototype.exposeConnection = function(id, connection) {
    var connections = _getJsonpConnections();
    connections[id] = connection;
  };
  BrowserJsonp.prototype.removeConnection = function(id) {
    var connections = _getJsonpConnections();
    connections[id] = null;
  };
  BrowserJsonp.prototype.send = function(node) {
    document.body.appendChild((node));
  };
  BrowserJsonp.prototype.cleanup = function(node) {
    if (node.parentNode) {
      node.parentNode.removeChild((node));
    }
  };
  BrowserJsonp = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [])], BrowserJsonp);
  return BrowserJsonp;
})();
exports.BrowserJsonp = BrowserJsonp;
