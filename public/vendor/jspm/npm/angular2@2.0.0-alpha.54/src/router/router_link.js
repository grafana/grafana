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
var core_1 = require('../../core');
var lang_1 = require('../facade/lang');
var router_1 = require('./router');
var location_1 = require('./location');
var RouterLink = (function() {
  function RouterLink(_router, _location) {
    this._router = _router;
    this._location = _location;
  }
  Object.defineProperty(RouterLink.prototype, "isRouteActive", {
    get: function() {
      return this._router.isRouteActive(this._navigationInstruction);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(RouterLink.prototype, "routeParams", {
    set: function(changes) {
      this._routeParams = changes;
      this._navigationInstruction = this._router.generate(this._routeParams);
      var navigationHref = this._navigationInstruction.toLinkUrl();
      this.visibleHref = this._location.prepareExternalUrl(navigationHref);
    },
    enumerable: true,
    configurable: true
  });
  RouterLink.prototype.onClick = function() {
    if (!lang_1.isString(this.target) || this.target == '_self') {
      this._router.navigateByInstruction(this._navigationInstruction);
      return false;
    }
    return true;
  };
  RouterLink = __decorate([core_1.Directive({
    selector: '[routerLink]',
    inputs: ['routeParams: routerLink', 'target: target'],
    host: {
      '(click)': 'onClick()',
      '[attr.href]': 'visibleHref',
      '[class.router-link-active]': 'isRouteActive'
    }
  }), __metadata('design:paramtypes', [router_1.Router, location_1.Location])], RouterLink);
  return RouterLink;
})();
exports.RouterLink = RouterLink;
