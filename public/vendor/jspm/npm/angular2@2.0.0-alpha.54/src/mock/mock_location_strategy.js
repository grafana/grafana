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
var location_strategy_1 = require('../router/location_strategy');
var MockLocationStrategy = (function(_super) {
  __extends(MockLocationStrategy, _super);
  function MockLocationStrategy() {
    _super.call(this);
    this.internalBaseHref = '/';
    this.internalPath = '/';
    this.internalTitle = '';
    this.urlChanges = [];
    this._subject = new async_1.EventEmitter();
  }
  MockLocationStrategy.prototype.simulatePopState = function(url) {
    this.internalPath = url;
    async_1.ObservableWrapper.callEmit(this._subject, new MockPopStateEvent(this.path()));
  };
  MockLocationStrategy.prototype.path = function() {
    return this.internalPath;
  };
  MockLocationStrategy.prototype.prepareExternalUrl = function(internal) {
    if (internal.startsWith('/') && this.internalBaseHref.endsWith('/')) {
      return this.internalBaseHref + internal.substring(1);
    }
    return this.internalBaseHref + internal;
  };
  MockLocationStrategy.prototype.pushState = function(ctx, title, path, query) {
    this.internalTitle = title;
    var url = path + (query.length > 0 ? ('?' + query) : '');
    this.internalPath = url;
    var externalUrl = this.prepareExternalUrl(url);
    this.urlChanges.push(externalUrl);
  };
  MockLocationStrategy.prototype.replaceState = function(ctx, title, path, query) {
    this.internalTitle = title;
    var url = path + (query.length > 0 ? ('?' + query) : '');
    this.internalPath = url;
    var externalUrl = this.prepareExternalUrl(url);
    this.urlChanges.push('replace: ' + externalUrl);
  };
  MockLocationStrategy.prototype.onPopState = function(fn) {
    async_1.ObservableWrapper.subscribe(this._subject, fn);
  };
  MockLocationStrategy.prototype.getBaseHref = function() {
    return this.internalBaseHref;
  };
  MockLocationStrategy.prototype.back = function() {
    if (this.urlChanges.length > 0) {
      this.urlChanges.pop();
      var nextUrl = this.urlChanges.length > 0 ? this.urlChanges[this.urlChanges.length - 1] : '';
      this.simulatePopState(nextUrl);
    }
  };
  MockLocationStrategy.prototype.forward = function() {
    throw 'not implemented';
  };
  MockLocationStrategy = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], MockLocationStrategy);
  return MockLocationStrategy;
})(location_strategy_1.LocationStrategy);
exports.MockLocationStrategy = MockLocationStrategy;
var MockPopStateEvent = (function() {
  function MockPopStateEvent(newUrl) {
    this.newUrl = newUrl;
    this.pop = true;
    this.type = 'popstate';
  }
  return MockPopStateEvent;
})();
