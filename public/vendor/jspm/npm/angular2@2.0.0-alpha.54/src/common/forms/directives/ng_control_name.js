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
var async_1 = require('../../../facade/async');
var core_1 = require('../../../../core');
var control_container_1 = require('./control_container');
var ng_control_1 = require('./ng_control');
var control_value_accessor_1 = require('./control_value_accessor');
var shared_1 = require('./shared');
var validators_1 = require('../validators');
var controlNameBinding = lang_1.CONST_EXPR(new core_1.Provider(ng_control_1.NgControl, {useExisting: core_1.forwardRef(function() {
    return NgControlName;
  })}));
var NgControlName = (function(_super) {
  __extends(NgControlName, _super);
  function NgControlName(_parent, _validators, _asyncValidators, valueAccessors) {
    _super.call(this);
    this._parent = _parent;
    this._validators = _validators;
    this._asyncValidators = _asyncValidators;
    this.update = new async_1.EventEmitter();
    this._added = false;
    this.valueAccessor = shared_1.selectValueAccessor(this, valueAccessors);
  }
  NgControlName.prototype.ngOnChanges = function(changes) {
    if (!this._added) {
      this.formDirective.addControl(this);
      this._added = true;
    }
    if (shared_1.isPropertyUpdated(changes, this.viewModel)) {
      this.viewModel = this.model;
      this.formDirective.updateModel(this, this.model);
    }
  };
  NgControlName.prototype.ngOnDestroy = function() {
    this.formDirective.removeControl(this);
  };
  NgControlName.prototype.viewToModelUpdate = function(newValue) {
    this.viewModel = newValue;
    async_1.ObservableWrapper.callEmit(this.update, newValue);
  };
  Object.defineProperty(NgControlName.prototype, "path", {
    get: function() {
      return shared_1.controlPath(this.name, this._parent);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlName.prototype, "formDirective", {
    get: function() {
      return this._parent.formDirective;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlName.prototype, "validator", {
    get: function() {
      return shared_1.composeValidators(this._validators);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlName.prototype, "asyncValidator", {
    get: function() {
      return shared_1.composeAsyncValidators(this._asyncValidators);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlName.prototype, "control", {
    get: function() {
      return this.formDirective.getControl(this);
    },
    enumerable: true,
    configurable: true
  });
  NgControlName = __decorate([core_1.Directive({
    selector: '[ngControl]',
    bindings: [controlNameBinding],
    inputs: ['name: ngControl', 'model: ngModel'],
    outputs: ['update: ngModelChange'],
    exportAs: 'ngForm'
  }), __param(0, core_1.Host()), __param(0, core_1.SkipSelf()), __param(1, core_1.Optional()), __param(1, core_1.Self()), __param(1, core_1.Inject(validators_1.NG_VALIDATORS)), __param(2, core_1.Optional()), __param(2, core_1.Self()), __param(2, core_1.Inject(validators_1.NG_ASYNC_VALIDATORS)), __param(3, core_1.Optional()), __param(3, core_1.Self()), __param(3, core_1.Inject(control_value_accessor_1.NG_VALUE_ACCESSOR)), __metadata('design:paramtypes', [control_container_1.ControlContainer, Array, Array, Array])], NgControlName);
  return NgControlName;
})(ng_control_1.NgControl);
exports.NgControlName = NgControlName;
