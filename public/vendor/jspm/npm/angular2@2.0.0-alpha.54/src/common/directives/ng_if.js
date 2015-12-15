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
var NgIf = (function() {
  function NgIf(_viewContainer, _templateRef) {
    this._viewContainer = _viewContainer;
    this._templateRef = _templateRef;
    this._prevCondition = null;
  }
  Object.defineProperty(NgIf.prototype, "ngIf", {
    set: function(newCondition) {
      if (newCondition && (lang_1.isBlank(this._prevCondition) || !this._prevCondition)) {
        this._prevCondition = true;
        this._viewContainer.createEmbeddedView(this._templateRef);
      } else if (!newCondition && (lang_1.isBlank(this._prevCondition) || this._prevCondition)) {
        this._prevCondition = false;
        this._viewContainer.clear();
      }
    },
    enumerable: true,
    configurable: true
  });
  NgIf = __decorate([core_1.Directive({
    selector: '[ngIf]',
    inputs: ['ngIf']
  }), __metadata('design:paramtypes', [core_1.ViewContainerRef, core_1.TemplateRef])], NgIf);
  return NgIf;
})();
exports.NgIf = NgIf;
