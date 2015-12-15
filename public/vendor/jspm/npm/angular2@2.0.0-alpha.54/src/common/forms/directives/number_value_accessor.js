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
var NUMBER_VALUE_ACCESSOR = lang_1.CONST_EXPR(new core_1.Provider(control_value_accessor_1.NG_VALUE_ACCESSOR, {
  useExisting: core_1.forwardRef(function() {
    return NumberValueAccessor;
  }),
  multi: true
}));
var NumberValueAccessor = (function() {
  function NumberValueAccessor(_renderer, _elementRef) {
    this._renderer = _renderer;
    this._elementRef = _elementRef;
    this.onChange = function(_) {};
    this.onTouched = function() {};
  }
  NumberValueAccessor.prototype.writeValue = function(value) {
    this._renderer.setElementProperty(this._elementRef, 'value', value);
  };
  NumberValueAccessor.prototype.registerOnChange = function(fn) {
    this.onChange = function(value) {
      fn(lang_1.NumberWrapper.parseFloat(value));
    };
  };
  NumberValueAccessor.prototype.registerOnTouched = function(fn) {
    this.onTouched = fn;
  };
  NumberValueAccessor = __decorate([core_1.Directive({
    selector: 'input[type=number][ngControl],input[type=number][ngFormControl],input[type=number][ngModel]',
    host: {
      '(change)': 'onChange($event.target.value)',
      '(input)': 'onChange($event.target.value)',
      '(blur)': 'onTouched()'
    },
    bindings: [NUMBER_VALUE_ACCESSOR]
  }), __metadata('design:paramtypes', [core_1.Renderer, core_1.ElementRef])], NumberValueAccessor);
  return NumberValueAccessor;
})();
exports.NumberValueAccessor = NumberValueAccessor;
