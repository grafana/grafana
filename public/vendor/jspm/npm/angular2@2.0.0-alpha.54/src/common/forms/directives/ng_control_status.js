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
var __param = (this && this.__param) || function(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
};
var core_1 = require('../../../../core');
var ng_control_1 = require('./ng_control');
var lang_1 = require('../../../facade/lang');
var NgControlStatus = (function() {
  function NgControlStatus(cd) {
    this._cd = cd;
  }
  Object.defineProperty(NgControlStatus.prototype, "ngClassUntouched", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? this._cd.control.untouched : false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlStatus.prototype, "ngClassTouched", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? this._cd.control.touched : false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlStatus.prototype, "ngClassPristine", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? this._cd.control.pristine : false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlStatus.prototype, "ngClassDirty", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? this._cd.control.dirty : false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlStatus.prototype, "ngClassValid", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? this._cd.control.valid : false;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlStatus.prototype, "ngClassInvalid", {
    get: function() {
      return lang_1.isPresent(this._cd.control) ? !this._cd.control.valid : false;
    },
    enumerable: true,
    configurable: true
  });
  NgControlStatus = __decorate([core_1.Directive({
    selector: '[ngControl],[ngModel],[ngFormControl]',
    host: {
      '[class.ng-untouched]': 'ngClassUntouched',
      '[class.ng-touched]': 'ngClassTouched',
      '[class.ng-pristine]': 'ngClassPristine',
      '[class.ng-dirty]': 'ngClassDirty',
      '[class.ng-valid]': 'ngClassValid',
      '[class.ng-invalid]': 'ngClassInvalid'
    }
  }), __param(0, core_1.Self()), __metadata('design:paramtypes', [ng_control_1.NgControl])], NgControlStatus);
  return NgControlStatus;
})();
exports.NgControlStatus = NgControlStatus;
