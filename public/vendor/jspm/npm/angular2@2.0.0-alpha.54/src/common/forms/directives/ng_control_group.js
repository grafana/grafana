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
var core_1 = require('../../../../core');
var lang_1 = require('../../../facade/lang');
var control_container_1 = require('./control_container');
var shared_1 = require('./shared');
var validators_1 = require('../validators');
var controlGroupProvider = lang_1.CONST_EXPR(new core_1.Provider(control_container_1.ControlContainer, {useExisting: core_1.forwardRef(function() {
    return NgControlGroup;
  })}));
var NgControlGroup = (function(_super) {
  __extends(NgControlGroup, _super);
  function NgControlGroup(parent, _validators, _asyncValidators) {
    _super.call(this);
    this._validators = _validators;
    this._asyncValidators = _asyncValidators;
    this._parent = parent;
  }
  NgControlGroup.prototype.ngOnInit = function() {
    this.formDirective.addControlGroup(this);
  };
  NgControlGroup.prototype.ngOnDestroy = function() {
    this.formDirective.removeControlGroup(this);
  };
  Object.defineProperty(NgControlGroup.prototype, "control", {
    get: function() {
      return this.formDirective.getControlGroup(this);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlGroup.prototype, "path", {
    get: function() {
      return shared_1.controlPath(this.name, this._parent);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlGroup.prototype, "formDirective", {
    get: function() {
      return this._parent.formDirective;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlGroup.prototype, "validator", {
    get: function() {
      return shared_1.composeValidators(this._validators);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControlGroup.prototype, "asyncValidator", {
    get: function() {
      return shared_1.composeAsyncValidators(this._asyncValidators);
    },
    enumerable: true,
    configurable: true
  });
  NgControlGroup = __decorate([core_1.Directive({
    selector: '[ngControlGroup]',
    providers: [controlGroupProvider],
    inputs: ['name: ngControlGroup'],
    exportAs: 'ngForm'
  }), __param(0, core_1.Host()), __param(0, core_1.SkipSelf()), __param(1, core_1.Optional()), __param(1, core_1.Self()), __param(1, core_1.Inject(validators_1.NG_VALIDATORS)), __param(2, core_1.Optional()), __param(2, core_1.Self()), __param(2, core_1.Inject(validators_1.NG_ASYNC_VALIDATORS)), __metadata('design:paramtypes', [control_container_1.ControlContainer, Array, Array])], NgControlGroup);
  return NgControlGroup;
})(control_container_1.ControlContainer);
exports.NgControlGroup = NgControlGroup;
