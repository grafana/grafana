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
var async_1 = require('../../../facade/async');
var control_value_accessor_1 = require('./control_value_accessor');
var lang_1 = require('../../../facade/lang');
var SELECT_VALUE_ACCESSOR = lang_1.CONST_EXPR(new core_1.Provider(control_value_accessor_1.NG_VALUE_ACCESSOR, {
  useExisting: core_1.forwardRef(function() {
    return SelectControlValueAccessor;
  }),
  multi: true
}));
var NgSelectOption = (function() {
  function NgSelectOption() {}
  NgSelectOption = __decorate([core_1.Directive({selector: 'option'}), __metadata('design:paramtypes', [])], NgSelectOption);
  return NgSelectOption;
})();
exports.NgSelectOption = NgSelectOption;
var SelectControlValueAccessor = (function() {
  function SelectControlValueAccessor(_renderer, _elementRef, query) {
    this._renderer = _renderer;
    this._elementRef = _elementRef;
    this.onChange = function(_) {};
    this.onTouched = function() {};
    this._updateValueWhenListOfOptionsChanges(query);
  }
  SelectControlValueAccessor.prototype.writeValue = function(value) {
    this.value = value;
    this._renderer.setElementProperty(this._elementRef, 'value', value);
  };
  SelectControlValueAccessor.prototype.registerOnChange = function(fn) {
    this.onChange = fn;
  };
  SelectControlValueAccessor.prototype.registerOnTouched = function(fn) {
    this.onTouched = fn;
  };
  SelectControlValueAccessor.prototype._updateValueWhenListOfOptionsChanges = function(query) {
    var _this = this;
    async_1.ObservableWrapper.subscribe(query.changes, function(_) {
      return _this.writeValue(_this.value);
    });
  };
  SelectControlValueAccessor = __decorate([core_1.Directive({
    selector: 'select[ngControl],select[ngFormControl],select[ngModel]',
    host: {
      '(change)': 'onChange($event.target.value)',
      '(input)': 'onChange($event.target.value)',
      '(blur)': 'onTouched()'
    },
    bindings: [SELECT_VALUE_ACCESSOR]
  }), __param(2, core_1.Query(NgSelectOption, {descendants: true})), __metadata('design:paramtypes', [core_1.Renderer, core_1.ElementRef, core_1.QueryList])], SelectControlValueAccessor);
  return SelectControlValueAccessor;
})();
exports.SelectControlValueAccessor = SelectControlValueAccessor;
