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
var __param = (this && this.__param) || function(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
};
var core_1 = require('../../core');
var lang_1 = require('../facade/lang');
var exceptions_1 = require('../facade/exceptions');
var location_strategy_1 = require('./location_strategy');
var platform_location_1 = require('./platform_location');
var PathLocationStrategy = (function(_super) {
  __extends(PathLocationStrategy, _super);
  function PathLocationStrategy(_platformLocation, href) {
    _super.call(this);
    this._platformLocation = _platformLocation;
    if (lang_1.isBlank(href)) {
      href = this._platformLocation.getBaseHrefFromDOM();
    }
    if (lang_1.isBlank(href)) {
      throw new exceptions_1.BaseException("No base href set. Please provide a value for the APP_BASE_HREF token or add a base element to the document.");
    }
    this._baseHref = href;
  }
  PathLocationStrategy.prototype.onPopState = function(fn) {
    this._platformLocation.onPopState(fn);
    this._platformLocation.onHashChange(fn);
  };
  PathLocationStrategy.prototype.getBaseHref = function() {
    return this._baseHref;
  };
  PathLocationStrategy.prototype.prepareExternalUrl = function(internal) {
    return location_strategy_1.joinWithSlash(this._baseHref, internal);
  };
  PathLocationStrategy.prototype.path = function() {
    return this._platformLocation.pathname + location_strategy_1.normalizeQueryParams(this._platformLocation.search);
  };
  PathLocationStrategy.prototype.pushState = function(state, title, url, queryParams) {
    var externalUrl = this.prepareExternalUrl(url + location_strategy_1.normalizeQueryParams(queryParams));
    this._platformLocation.pushState(state, title, externalUrl);
  };
  PathLocationStrategy.prototype.replaceState = function(state, title, url, queryParams) {
    var externalUrl = this.prepareExternalUrl(url + location_strategy_1.normalizeQueryParams(queryParams));
    this._platformLocation.replaceState(state, title, externalUrl);
  };
  PathLocationStrategy.prototype.forward = function() {
    this._platformLocation.forward();
  };
  PathLocationStrategy.prototype.back = function() {
    this._platformLocation.back();
  };
  PathLocationStrategy = __decorate([core_1.Injectable(), __param(1, core_1.Optional()), __param(1, core_1.Inject(location_strategy_1.APP_BASE_HREF)), __metadata('design:paramtypes', [platform_location_1.PlatformLocation, String])], PathLocationStrategy);
  return PathLocationStrategy;
})(location_strategy_1.LocationStrategy);
exports.PathLocationStrategy = PathLocationStrategy;
