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
var di_1 = require('../core/di');
var async_1 = require('../facade/async');
var SpyLocation = (function() {
  function SpyLocation() {
    this.urlChanges = [];
    this._path = '';
    this._query = '';
    this._subject = new async_1.EventEmitter();
    this._baseHref = '';
    this.platformStrategy = null;
  }
  SpyLocation.prototype.setInitialPath = function(url) {
    this._path = url;
  };
  SpyLocation.prototype.setBaseHref = function(url) {
    this._baseHref = url;
  };
  SpyLocation.prototype.path = function() {
    return this._path;
  };
  SpyLocation.prototype.simulateUrlPop = function(pathname) {
    async_1.ObservableWrapper.callEmit(this._subject, {
      'url': pathname,
      'pop': true
    });
  };
  SpyLocation.prototype.simulateHashChange = function(pathname) {
    this.setInitialPath(pathname);
    this.urlChanges.push('hash: ' + pathname);
    async_1.ObservableWrapper.callEmit(this._subject, {
      'url': pathname,
      'pop': true,
      'type': 'hashchange'
    });
  };
  SpyLocation.prototype.prepareExternalUrl = function(url) {
    if (url.length > 0 && !url.startsWith('/')) {
      url = '/' + url;
    }
    return this._baseHref + url;
  };
  SpyLocation.prototype.go = function(path, query) {
    if (query === void 0) {
      query = '';
    }
    path = this.prepareExternalUrl(path);
    if (this._path == path && this._query == query) {
      return;
    }
    this._path = path;
    this._query = query;
    var url = path + (query.length > 0 ? ('?' + query) : '');
    this.urlChanges.push(url);
  };
  SpyLocation.prototype.replaceState = function(path, query) {
    if (query === void 0) {
      query = '';
    }
    path = this.prepareExternalUrl(path);
    this._path = path;
    this._query = query;
    var url = path + (query.length > 0 ? ('?' + query) : '');
    this.urlChanges.push('replace: ' + url);
  };
  SpyLocation.prototype.forward = function() {};
  SpyLocation.prototype.back = function() {};
  SpyLocation.prototype.subscribe = function(onNext, onThrow, onReturn) {
    if (onThrow === void 0) {
      onThrow = null;
    }
    if (onReturn === void 0) {
      onReturn = null;
    }
    return async_1.ObservableWrapper.subscribe(this._subject, onNext, onThrow, onReturn);
  };
  SpyLocation.prototype.normalize = function(url) {
    return null;
  };
  SpyLocation = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], SpyLocation);
  return SpyLocation;
})();
exports.SpyLocation = SpyLocation;
