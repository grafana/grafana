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
var core_1 = require('../../../../core');
var control_value_accessor_1 = require('./control_value_accessor');
var lang_1 = require('../../../facade/lang');
var DEFAULT_VALUE_ACCESSOR = lang_1.CONST_EXPR(new core_1.Provider(control_value_accessor_1.NG_VALUE_ACCESSOR, {
  useExisting: core_1.forwardRef(function() {
    return DefaultValueAccessor;
  }),
  multi: true
}));
var DefaultValueAccessor = (function() {
  function DefaultValueAccessor(_renderer, _elementRef) {
    this._renderer = _renderer;
    this._elementRef = _elementRef;
    this.onChange = function(_) {};
    this.onTouched = function() {};
  }
  DefaultValueAccessor.prototype.writeValue = function(value) {
    var normalizedValue = lang_1.isBlank(value) ? '' : value;
    this._renderer.setElementProperty(this._elementRef, 'value', normalizedValue);
  };
  DefaultValueAccessor.prototype.registerOnChange = function(fn) {
    this.onChange = fn;
  };
  DefaultValueAccessor.prototype.registerOnTouched = function(fn) {
    this.onTouched = fn;
  };
  DefaultValueAccessor = __decorate([core_1.Directive({
    selector: 'input:not([type=checkbox])[ngControl],textarea[ngControl],input:not([type=checkbox])[ngFormControl],textarea[ngFormControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]',
    host: {
      '(input)': 'onChange($event.target.value)',
      '(blur)': 'onTouched()'
    },
    bindings: [DEFAULT_VALUE_ACCESSOR]
  }), __metadata('design:paramtypes', [core_1.Renderer, core_1.ElementRef])], DefaultValueAccessor);
  return DefaultValueAccessor;
})();
exports.DefaultValueAccessor = DefaultValueAccessor;
