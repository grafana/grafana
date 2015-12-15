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
var lang_1 = require('../../facade/lang');
var async_1 = require('../../facade/async');
var promise_1 = require('../../facade/promise');
var collection_1 = require('../../facade/collection');
exports.VALID = "VALID";
exports.INVALID = "INVALID";
exports.PENDING = "PENDING";
function isControl(control) {
  return control instanceof AbstractControl;
}
exports.isControl = isControl;
function _find(control, path) {
  if (lang_1.isBlank(path))
    return null;
  if (!(path instanceof Array)) {
    path = path.split("/");
  }
  if (path instanceof Array && collection_1.ListWrapper.isEmpty(path))
    return null;
  return path.reduce(function(v, name) {
    if (v instanceof ControlGroup) {
      return lang_1.isPresent(v.controls[name]) ? v.controls[name] : null;
    } else if (v instanceof ControlArray) {
      var index = name;
      return lang_1.isPresent(v.at(index)) ? v.at(index) : null;
    } else {
      return null;
    }
  }, control);
}
function toObservable(r) {
  return promise_1.PromiseWrapper.isPromise(r) ? async_1.ObservableWrapper.fromPromise(r) : r;
}
var AbstractControl = (function() {
  function AbstractControl(validator, asyncValidator) {
    this.validator = validator;
    this.asyncValidator = asyncValidator;
    this._pristine = true;
    this._touched = false;
  }
  Object.defineProperty(AbstractControl.prototype, "value", {
    get: function() {
      return this._value;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "status", {
    get: function() {
      return this._status;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "valid", {
    get: function() {
      return this._status === exports.VALID;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "errors", {
    get: function() {
      return this._errors;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "pristine", {
    get: function() {
      return this._pristine;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "dirty", {
    get: function() {
      return !this.pristine;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "touched", {
    get: function() {
      return this._touched;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "untouched", {
    get: function() {
      return !this._touched;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "valueChanges", {
    get: function() {
      return this._valueChanges;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "statusChanges", {
    get: function() {
      return this._statusChanges;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(AbstractControl.prototype, "pending", {
    get: function() {
      return this._status == exports.PENDING;
    },
    enumerable: true,
    configurable: true
  });
  AbstractControl.prototype.markAsTouched = function() {
    this._touched = true;
  };
  AbstractControl.prototype.markAsDirty = function(_a) {
    var onlySelf = (_a === void 0 ? {} : _a).onlySelf;
    onlySelf = lang_1.normalizeBool(onlySelf);
    this._pristine = false;
    if (lang_1.isPresent(this._parent) && !onlySelf) {
      this._parent.markAsDirty({onlySelf: onlySelf});
    }
  };
  AbstractControl.prototype.markAsPending = function(_a) {
    var onlySelf = (_a === void 0 ? {} : _a).onlySelf;
    onlySelf = lang_1.normalizeBool(onlySelf);
    this._status = exports.PENDING;
    if (lang_1.isPresent(this._parent) && !onlySelf) {
      this._parent.markAsPending({onlySelf: onlySelf});
    }
  };
  AbstractControl.prototype.setParent = function(parent) {
    this._parent = parent;
  };
  AbstractControl.prototype.updateValueAndValidity = function(_a) {
    var _b = _a === void 0 ? {} : _a,
        onlySelf = _b.onlySelf,
        emitEvent = _b.emitEvent;
    onlySelf = lang_1.normalizeBool(onlySelf);
    emitEvent = lang_1.isPresent(emitEvent) ? emitEvent : true;
    this._updateValue();
    this._errors = this._runValidator();
    this._status = this._calculateStatus();
    if (this._status == exports.VALID || this._status == exports.PENDING) {
      this._runAsyncValidator(emitEvent);
    }
    if (emitEvent) {
      async_1.ObservableWrapper.callEmit(this._valueChanges, this._value);
      async_1.ObservableWrapper.callEmit(this._statusChanges, this._status);
    }
    if (lang_1.isPresent(this._parent) && !onlySelf) {
      this._parent.updateValueAndValidity({
        onlySelf: onlySelf,
        emitEvent: emitEvent
      });
    }
  };
  AbstractControl.prototype._runValidator = function() {
    return lang_1.isPresent(this.validator) ? this.validator(this) : null;
  };
  AbstractControl.prototype._runAsyncValidator = function(emitEvent) {
    var _this = this;
    if (lang_1.isPresent(this.asyncValidator)) {
      this._status = exports.PENDING;
      this._cancelExistingSubscription();
      var obs = toObservable(this.asyncValidator(this));
      this._asyncValidationSubscription = async_1.ObservableWrapper.subscribe(obs, function(res) {
        return _this.setErrors(res, {emitEvent: emitEvent});
      });
    }
  };
  AbstractControl.prototype._cancelExistingSubscription = function() {
    if (lang_1.isPresent(this._asyncValidationSubscription)) {
      async_1.ObservableWrapper.dispose(this._asyncValidationSubscription);
    }
  };
  AbstractControl.prototype.setErrors = function(errors, _a) {
    var emitEvent = (_a === void 0 ? {} : _a).emitEvent;
    emitEvent = lang_1.isPresent(emitEvent) ? emitEvent : true;
    this._errors = errors;
    this._status = this._calculateStatus();
    if (emitEvent) {
      async_1.ObservableWrapper.callEmit(this._statusChanges, this._status);
    }
    if (lang_1.isPresent(this._parent)) {
      this._parent._updateControlsErrors();
    }
  };
  AbstractControl.prototype.find = function(path) {
    return _find(this, path);
  };
  AbstractControl.prototype.getError = function(errorCode, path) {
    if (path === void 0) {
      path = null;
    }
    var control = lang_1.isPresent(path) && !collection_1.ListWrapper.isEmpty(path) ? this.find(path) : this;
    if (lang_1.isPresent(control) && lang_1.isPresent(control._errors)) {
      return collection_1.StringMapWrapper.get(control._errors, errorCode);
    } else {
      return null;
    }
  };
  AbstractControl.prototype.hasError = function(errorCode, path) {
    if (path === void 0) {
      path = null;
    }
    return lang_1.isPresent(this.getError(errorCode, path));
  };
  AbstractControl.prototype._updateControlsErrors = function() {
    this._status = this._calculateStatus();
    if (lang_1.isPresent(this._parent)) {
      this._parent._updateControlsErrors();
    }
  };
  AbstractControl.prototype._initObservables = function() {
    this._valueChanges = new async_1.EventEmitter();
    this._statusChanges = new async_1.EventEmitter();
  };
  AbstractControl.prototype._calculateStatus = function() {
    if (lang_1.isPresent(this._errors))
      return exports.INVALID;
    if (this._anyControlsHaveStatus(exports.PENDING))
      return exports.PENDING;
    if (this._anyControlsHaveStatus(exports.INVALID))
      return exports.INVALID;
    return exports.VALID;
  };
  return AbstractControl;
})();
exports.AbstractControl = AbstractControl;
var Control = (function(_super) {
  __extends(Control, _super);
  function Control(value, validator, asyncValidator) {
    if (value === void 0) {
      value = null;
    }
    if (validator === void 0) {
      validator = null;
    }
    if (asyncValidator === void 0) {
      asyncValidator = null;
    }
    _super.call(this, validator, asyncValidator);
    this._value = value;
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false
    });
    this._initObservables();
  }
  Control.prototype.updateValue = function(value, _a) {
    var _b = _a === void 0 ? {} : _a,
        onlySelf = _b.onlySelf,
        emitEvent = _b.emitEvent,
        emitModelToViewChange = _b.emitModelToViewChange;
    emitModelToViewChange = lang_1.isPresent(emitModelToViewChange) ? emitModelToViewChange : true;
    this._value = value;
    if (lang_1.isPresent(this._onChange) && emitModelToViewChange)
      this._onChange(this._value);
    this.updateValueAndValidity({
      onlySelf: onlySelf,
      emitEvent: emitEvent
    });
  };
  Control.prototype._updateValue = function() {};
  Control.prototype._anyControlsHaveStatus = function(status) {
    return false;
  };
  Control.prototype.registerOnChange = function(fn) {
    this._onChange = fn;
  };
  return Control;
})(AbstractControl);
exports.Control = Control;
var ControlGroup = (function(_super) {
  __extends(ControlGroup, _super);
  function ControlGroup(controls, optionals, validator, asyncValidator) {
    if (optionals === void 0) {
      optionals = null;
    }
    if (validator === void 0) {
      validator = null;
    }
    if (asyncValidator === void 0) {
      asyncValidator = null;
    }
    _super.call(this, validator, asyncValidator);
    this.controls = controls;
    this._optionals = lang_1.isPresent(optionals) ? optionals : {};
    this._initObservables();
    this._setParentForControls();
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false
    });
  }
  ControlGroup.prototype.addControl = function(name, control) {
    this.controls[name] = control;
    control.setParent(this);
  };
  ControlGroup.prototype.removeControl = function(name) {
    collection_1.StringMapWrapper.delete(this.controls, name);
  };
  ControlGroup.prototype.include = function(controlName) {
    collection_1.StringMapWrapper.set(this._optionals, controlName, true);
    this.updateValueAndValidity();
  };
  ControlGroup.prototype.exclude = function(controlName) {
    collection_1.StringMapWrapper.set(this._optionals, controlName, false);
    this.updateValueAndValidity();
  };
  ControlGroup.prototype.contains = function(controlName) {
    var c = collection_1.StringMapWrapper.contains(this.controls, controlName);
    return c && this._included(controlName);
  };
  ControlGroup.prototype._setParentForControls = function() {
    var _this = this;
    collection_1.StringMapWrapper.forEach(this.controls, function(control, name) {
      control.setParent(_this);
    });
  };
  ControlGroup.prototype._updateValue = function() {
    this._value = this._reduceValue();
  };
  ControlGroup.prototype._anyControlsHaveStatus = function(status) {
    var _this = this;
    var res = false;
    collection_1.StringMapWrapper.forEach(this.controls, function(control, name) {
      res = res || (_this.contains(name) && control.status == status);
    });
    return res;
  };
  ControlGroup.prototype._reduceValue = function() {
    return this._reduceChildren({}, function(acc, control, name) {
      acc[name] = control.value;
      return acc;
    });
  };
  ControlGroup.prototype._reduceChildren = function(initValue, fn) {
    var _this = this;
    var res = initValue;
    collection_1.StringMapWrapper.forEach(this.controls, function(control, name) {
      if (_this._included(name)) {
        res = fn(res, control, name);
      }
    });
    return res;
  };
  ControlGroup.prototype._included = function(controlName) {
    var isOptional = collection_1.StringMapWrapper.contains(this._optionals, controlName);
    return !isOptional || collection_1.StringMapWrapper.get(this._optionals, controlName);
  };
  return ControlGroup;
})(AbstractControl);
exports.ControlGroup = ControlGroup;
var ControlArray = (function(_super) {
  __extends(ControlArray, _super);
  function ControlArray(controls, validator, asyncValidator) {
    if (validator === void 0) {
      validator = null;
    }
    if (asyncValidator === void 0) {
      asyncValidator = null;
    }
    _super.call(this, validator, asyncValidator);
    this.controls = controls;
    this._initObservables();
    this._setParentForControls();
    this.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false
    });
  }
  ControlArray.prototype.at = function(index) {
    return this.controls[index];
  };
  ControlArray.prototype.push = function(control) {
    this.controls.push(control);
    control.setParent(this);
    this.updateValueAndValidity();
  };
  ControlArray.prototype.insert = function(index, control) {
    collection_1.ListWrapper.insert(this.controls, index, control);
    control.setParent(this);
    this.updateValueAndValidity();
  };
  ControlArray.prototype.removeAt = function(index) {
    collection_1.ListWrapper.removeAt(this.controls, index);
    this.updateValueAndValidity();
  };
  Object.defineProperty(ControlArray.prototype, "length", {
    get: function() {
      return this.controls.length;
    },
    enumerable: true,
    configurable: true
  });
  ControlArray.prototype._updateValue = function() {
    this._value = this.controls.map(function(control) {
      return control.value;
    });
  };
  ControlArray.prototype._anyControlsHaveStatus = function(status) {
    return this.controls.some(function(c) {
      return c.status == status;
    });
  };
  ControlArray.prototype._setParentForControls = function() {
    var _this = this;
    this.controls.forEach(function(control) {
      control.setParent(_this);
    });
  };
  return ControlArray;
})(AbstractControl);
exports.ControlArray = ControlArray;
