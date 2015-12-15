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
var async_1 = require('../../../facade/async');
var collection_1 = require('../../../facade/collection');
var lang_1 = require('../../../facade/lang');
var core_1 = require('../../../../core');
var control_container_1 = require('./control_container');
var model_1 = require('../model');
var shared_1 = require('./shared');
var validators_1 = require('../validators');
var formDirectiveProvider = lang_1.CONST_EXPR(new core_1.Provider(control_container_1.ControlContainer, {useExisting: core_1.forwardRef(function() {
    return NgForm;
  })}));
var NgForm = (function(_super) {
  __extends(NgForm, _super);
  function NgForm(validators, asyncValidators) {
    _super.call(this);
    this.ngSubmit = new async_1.EventEmitter();
    this.form = new model_1.ControlGroup({}, null, shared_1.composeValidators(validators), shared_1.composeAsyncValidators(asyncValidators));
  }
  Object.defineProperty(NgForm.prototype, "formDirective", {
    get: function() {
      return this;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgForm.prototype, "control", {
    get: function() {
      return this.form;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgForm.prototype, "path", {
    get: function() {
      return [];
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgForm.prototype, "controls", {
    get: function() {
      return this.form.controls;
    },
    enumerable: true,
    configurable: true
  });
  NgForm.prototype.addControl = function(dir) {
    var _this = this;
    async_1.PromiseWrapper.scheduleMicrotask(function() {
      var container = _this._findContainer(dir.path);
      var ctrl = new model_1.Control();
      shared_1.setUpControl(ctrl, dir);
      container.addControl(dir.name, ctrl);
      ctrl.updateValueAndValidity({emitEvent: false});
    });
  };
  NgForm.prototype.getControl = function(dir) {
    return this.form.find(dir.path);
  };
  NgForm.prototype.removeControl = function(dir) {
    var _this = this;
    async_1.PromiseWrapper.scheduleMicrotask(function() {
      var container = _this._findContainer(dir.path);
      if (lang_1.isPresent(container)) {
        container.removeControl(dir.name);
        container.updateValueAndValidity({emitEvent: false});
      }
    });
  };
  NgForm.prototype.addControlGroup = function(dir) {
    var _this = this;
    async_1.PromiseWrapper.scheduleMicrotask(function() {
      var container = _this._findContainer(dir.path);
      var group = new model_1.ControlGroup({});
      shared_1.setUpControlGroup(group, dir);
      container.addControl(dir.name, group);
      group.updateValueAndValidity({emitEvent: false});
    });
  };
  NgForm.prototype.removeControlGroup = function(dir) {
    var _this = this;
    async_1.PromiseWrapper.scheduleMicrotask(function() {
      var container = _this._findContainer(dir.path);
      if (lang_1.isPresent(container)) {
        container.removeControl(dir.name);
        container.updateValueAndValidity({emitEvent: false});
      }
    });
  };
  NgForm.prototype.getControlGroup = function(dir) {
    return this.form.find(dir.path);
  };
  NgForm.prototype.updateModel = function(dir, value) {
    var _this = this;
    async_1.PromiseWrapper.scheduleMicrotask(function() {
      var ctrl = _this.form.find(dir.path);
      ctrl.updateValue(value);
    });
  };
  NgForm.prototype.onSubmit = function() {
    async_1.ObservableWrapper.callEmit(this.ngSubmit, null);
    return false;
  };
  NgForm.prototype._findContainer = function(path) {
    path.pop();
    return collection_1.ListWrapper.isEmpty(path) ? this.form : this.form.find(path);
  };
  NgForm = __decorate([core_1.Directive({
    selector: 'form:not([ngNoForm]):not([ngFormModel]),ngForm,[ngForm]',
    bindings: [formDirectiveProvider],
    host: {'(submit)': 'onSubmit()'},
    outputs: ['ngSubmit'],
    exportAs: 'ngForm'
  }), __param(0, core_1.Optional()), __param(0, core_1.Self()), __param(0, core_1.Inject(validators_1.NG_VALIDATORS)), __param(1, core_1.Optional()), __param(1, core_1.Self()), __param(1, core_1.Inject(validators_1.NG_ASYNC_VALIDATORS)), __metadata('design:paramtypes', [Array, Array])], NgForm);
  return NgForm;
})(control_container_1.ControlContainer);
exports.NgForm = NgForm;
