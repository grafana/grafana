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
var lang_1 = require('../../../facade/lang');
var validators_1 = require('../validators');
var lang_2 = require('../../../facade/lang');
var REQUIRED_VALIDATOR = lang_1.CONST_EXPR(new core_1.Provider(validators_1.NG_VALIDATORS, {
  useValue: validators_1.Validators.required,
  multi: true
}));
var RequiredValidator = (function() {
  function RequiredValidator() {}
  RequiredValidator = __decorate([core_1.Directive({
    selector: '[required][ngControl],[required][ngFormControl],[required][ngModel]',
    providers: [REQUIRED_VALIDATOR]
  }), __metadata('design:paramtypes', [])], RequiredValidator);
  return RequiredValidator;
})();
exports.RequiredValidator = RequiredValidator;
var MIN_LENGTH_VALIDATOR = lang_1.CONST_EXPR(new core_1.Provider(validators_1.NG_VALIDATORS, {
  useExisting: core_1.forwardRef(function() {
    return MinLengthValidator;
  }),
  multi: true
}));
var MinLengthValidator = (function() {
  function MinLengthValidator(minLength) {
    this._validator = validators_1.Validators.minLength(lang_2.NumberWrapper.parseInt(minLength, 10));
  }
  MinLengthValidator.prototype.validate = function(c) {
    return this._validator(c);
  };
  MinLengthValidator = __decorate([core_1.Directive({
    selector: '[minlength][ngControl],[minlength][ngFormControl],[minlength][ngModel]',
    providers: [MIN_LENGTH_VALIDATOR]
  }), __param(0, core_1.Attribute("minlength")), __metadata('design:paramtypes', [String])], MinLengthValidator);
  return MinLengthValidator;
})();
exports.MinLengthValidator = MinLengthValidator;
var MAX_LENGTH_VALIDATOR = lang_1.CONST_EXPR(new core_1.Provider(validators_1.NG_VALIDATORS, {
  useExisting: core_1.forwardRef(function() {
    return MaxLengthValidator;
  }),
  multi: true
}));
var MaxLengthValidator = (function() {
  function MaxLengthValidator(maxLength) {
    this._validator = validators_1.Validators.maxLength(lang_2.NumberWrapper.parseInt(maxLength, 10));
  }
  MaxLengthValidator.prototype.validate = function(c) {
    return this._validator(c);
  };
  MaxLengthValidator = __decorate([core_1.Directive({
    selector: '[maxlength][ngControl],[maxlength][ngFormControl],[maxlength][ngModel]',
    providers: [MAX_LENGTH_VALIDATOR]
  }), __param(0, core_1.Attribute("maxlength")), __metadata('design:paramtypes', [String])], MaxLengthValidator);
  return MaxLengthValidator;
})();
exports.MaxLengthValidator = MaxLengthValidator;
