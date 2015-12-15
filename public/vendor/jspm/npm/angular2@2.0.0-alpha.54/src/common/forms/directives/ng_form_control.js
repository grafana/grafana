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
var lang_1 = require('../../../facade/lang');
var collection_1 = require('../../../facade/collection');
var async_1 = require('../../../facade/async');
var core_1 = require('../../../../core');
var ng_control_1 = require('./ng_control');
var validators_1 = require('../validators');
var control_value_accessor_1 = require('./control_value_accessor');
var shared_1 = require('./shared');
var formControlBinding = lang_1.CONST_EXPR(new core_1.Provider(ng_control_1.NgControl, {useExisting: core_1.forwardRef(function() {
    return NgFormControl;
  })}));
var NgFormControl = (function(_super) {
  __extends(NgFormControl, _super);
  function NgFormControl(_validators, _asyncValidators, valueAccessors) {
    _super.call(this);
    this._validators = _validators;
    this._asyncValidators = _asyncValidators;
    this.update = new async_1.EventEmitter();
    this.valueAccessor = shared_1.selectValueAccessor(this, valueAccessors);
  }
  NgFormControl.prototype.ngOnChanges = function(changes) {
    if (this._isControlChanged(changes)) {
      shared_1.setUpControl(this.form, this);
      this.form.updateValueAndValidity({emitEvent: false});
    }
    if (shared_1.isPropertyUpdated(changes, this.viewModel)) {
      this.form.updateValue(this.model);
      this.viewModel = this.model;
    }
  };
  Object.defineProperty(NgFormControl.prototype, "path", {
    get: function() {
      return [];
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFormControl.prototype, "validator", {
    get: function() {
      return shared_1.composeValidators(this._validators);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFormControl.prototype, "asyncValidator", {
    get: function() {
      return shared_1.composeAsyncValidators(this._asyncValidators);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFormControl.prototype, "control", {
    get: function() {
      return this.form;
    },
    enumerable: true,
    configurable: true
  });
  NgFormControl.prototype.viewToModelUpdate = function(newValue) {
    this.viewModel = newValue;
    async_1.ObservableWrapper.callEmit(this.update, newValue);
  };
  NgFormControl.prototype._isControlChanged = function(changes) {
    return collection_1.StringMapWrapper.contains(changes, "form");
  };
  NgFormControl = __decorate([core_1.Directive({
    selector: '[ngFormControl]',
    bindings: [formControlBinding],
    inputs: ['form: ngFormControl', 'model: ngModel'],
    outputs: ['update: ngModelChange'],
    exportAs: 'ngForm'
  }), __param(0, core_1.Optional()), __param(0, core_1.Self()), __param(0, core_1.Inject(validators_1.NG_VALIDATORS)), __param(1, core_1.Optional()), __param(1, core_1.Self()), __param(1, core_1.Inject(validators_1.NG_ASYNC_VALIDATORS)), __param(2, core_1.Optional()), __param(2, core_1.Self()), __param(2, core_1.Inject(control_value_accessor_1.NG_VALUE_ACCESSOR)), __metadata('design:paramtypes', [Array, Array, Array])], NgFormControl);
  return NgFormControl;
})(ng_control_1.NgControl);
exports.NgFormControl = NgFormControl;
