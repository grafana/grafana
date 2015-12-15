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
var control_container_1 = require('./control_container');
var shared_1 = require('./shared');
var validators_1 = require('../validators');
var formDirectiveProvider = lang_1.CONST_EXPR(new core_1.Provider(control_container_1.ControlContainer, {useExisting: core_1.forwardRef(function() {
    return NgFormModel;
  })}));
var NgFormModel = (function(_super) {
  __extends(NgFormModel, _super);
  function NgFormModel(_validators, _asyncValidators) {
    _super.call(this);
    this._validators = _validators;
    this._asyncValidators = _asyncValidators;
    this.form = null;
    this.directives = [];
    this.ngSubmit = new async_1.EventEmitter();
  }
  NgFormModel.prototype.ngOnChanges = function(changes) {
    if (collection_1.StringMapWrapper.contains(changes, "form")) {
      var sync = shared_1.composeValidators(this._validators);
      this.form.validator = validators_1.Validators.compose([this.form.validator, sync]);
      var async = shared_1.composeAsyncValidators(this._asyncValidators);
      this.form.asyncValidator = validators_1.Validators.composeAsync([this.form.asyncValidator, async]);
      this.form.updateValueAndValidity({
        onlySelf: true,
        emitEvent: false
      });
    }
    this._updateDomValue();
  };
  Object.defineProperty(NgFormModel.prototype, "formDirective", {
    get: function() {
      return this;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFormModel.prototype, "control", {
    get: function() {
      return this.form;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFormModel.prototype, "path", {
    get: function() {
      return [];
    },
    enumerable: true,
    configurable: true
  });
  NgFormModel.prototype.addControl = function(dir) {
    var ctrl = this.form.find(dir.path);
    shared_1.setUpControl(ctrl, dir);
    ctrl.updateValueAndValidity({emitEvent: false});
    this.directives.push(dir);
  };
  NgFormModel.prototype.getControl = function(dir) {
    return this.form.find(dir.path);
  };
  NgFormModel.prototype.removeControl = function(dir) {
    collection_1.ListWrapper.remove(this.directives, dir);
  };
  NgFormModel.prototype.addControlGroup = function(dir) {
    var ctrl = this.form.find(dir.path);
    shared_1.setUpControlGroup(ctrl, dir);
    ctrl.updateValueAndValidity({emitEvent: false});
  };
  NgFormModel.prototype.removeControlGroup = function(dir) {};
  NgFormModel.prototype.getControlGroup = function(dir) {
    return this.form.find(dir.path);
  };
  NgFormModel.prototype.updateModel = function(dir, value) {
    var ctrl = this.form.find(dir.path);
    ctrl.updateValue(value);
  };
  NgFormModel.prototype.onSubmit = function() {
    async_1.ObservableWrapper.callEmit(this.ngSubmit, null);
    return false;
  };
  NgFormModel.prototype._updateDomValue = function() {
    var _this = this;
    this.directives.forEach(function(dir) {
      var ctrl = _this.form.find(dir.path);
      dir.valueAccessor.writeValue(ctrl.value);
    });
  };
  NgFormModel = __decorate([core_1.Directive({
    selector: '[ngFormModel]',
    bindings: [formDirectiveProvider],
    inputs: ['form: ngFormModel'],
    host: {'(submit)': 'onSubmit()'},
    outputs: ['ngSubmit'],
    exportAs: 'ngForm'
  }), __param(0, core_1.Optional()), __param(0, core_1.Self()), __param(0, core_1.Inject(validators_1.NG_VALIDATORS)), __param(1, core_1.Optional()), __param(1, core_1.Self()), __param(1, core_1.Inject(validators_1.NG_ASYNC_VALIDATORS)), __metadata('design:paramtypes', [Array, Array])], NgFormModel);
  return NgFormModel;
})(control_container_1.ControlContainer);
exports.NgFormModel = NgFormModel;
