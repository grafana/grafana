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
var lang_1 = require('../../facade/lang');
var core_1 = require('../../../core');
var collection_1 = require('../../facade/collection');
var NgClass = (function() {
  function NgClass(_iterableDiffers, _keyValueDiffers, _ngEl, _renderer) {
    this._iterableDiffers = _iterableDiffers;
    this._keyValueDiffers = _keyValueDiffers;
    this._ngEl = _ngEl;
    this._renderer = _renderer;
    this._initialClasses = [];
  }
  Object.defineProperty(NgClass.prototype, "initialClasses", {
    set: function(v) {
      this._applyInitialClasses(true);
      this._initialClasses = lang_1.isPresent(v) && lang_1.isString(v) ? v.split(' ') : [];
      this._applyInitialClasses(false);
      this._applyClasses(this._rawClass, false);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgClass.prototype, "rawClass", {
    set: function(v) {
      this._cleanupClasses(this._rawClass);
      if (lang_1.isString(v)) {
        v = v.split(' ');
      }
      this._rawClass = v;
      if (lang_1.isPresent(v)) {
        if (collection_1.isListLikeIterable(v)) {
          this._differ = this._iterableDiffers.find(v).create(null);
          this._mode = 'iterable';
        } else {
          this._differ = this._keyValueDiffers.find(v).create(null);
          this._mode = 'keyValue';
        }
      } else {
        this._differ = null;
      }
    },
    enumerable: true,
    configurable: true
  });
  NgClass.prototype.ngDoCheck = function() {
    if (lang_1.isPresent(this._differ)) {
      var changes = this._differ.diff(this._rawClass);
      if (lang_1.isPresent(changes)) {
        if (this._mode == 'iterable') {
          this._applyIterableChanges(changes);
        } else {
          this._applyKeyValueChanges(changes);
        }
      }
    }
  };
  NgClass.prototype.ngOnDestroy = function() {
    this._cleanupClasses(this._rawClass);
  };
  NgClass.prototype._cleanupClasses = function(rawClassVal) {
    this._applyClasses(rawClassVal, true);
    this._applyInitialClasses(false);
  };
  NgClass.prototype._applyKeyValueChanges = function(changes) {
    var _this = this;
    changes.forEachAddedItem(function(record) {
      _this._toggleClass(record.key, record.currentValue);
    });
    changes.forEachChangedItem(function(record) {
      _this._toggleClass(record.key, record.currentValue);
    });
    changes.forEachRemovedItem(function(record) {
      if (record.previousValue) {
        _this._toggleClass(record.key, false);
      }
    });
  };
  NgClass.prototype._applyIterableChanges = function(changes) {
    var _this = this;
    changes.forEachAddedItem(function(record) {
      _this._toggleClass(record.item, true);
    });
    changes.forEachRemovedItem(function(record) {
      _this._toggleClass(record.item, false);
    });
  };
  NgClass.prototype._applyInitialClasses = function(isCleanup) {
    var _this = this;
    this._initialClasses.forEach(function(className) {
      return _this._toggleClass(className, !isCleanup);
    });
  };
  NgClass.prototype._applyClasses = function(rawClassVal, isCleanup) {
    var _this = this;
    if (lang_1.isPresent(rawClassVal)) {
      if (lang_1.isArray(rawClassVal)) {
        rawClassVal.forEach(function(className) {
          return _this._toggleClass(className, !isCleanup);
        });
      } else if (rawClassVal instanceof Set) {
        rawClassVal.forEach(function(className) {
          return _this._toggleClass(className, !isCleanup);
        });
      } else {
        collection_1.StringMapWrapper.forEach(rawClassVal, function(expVal, className) {
          if (expVal)
            _this._toggleClass(className, !isCleanup);
        });
      }
    }
  };
  NgClass.prototype._toggleClass = function(className, enabled) {
    className = className.trim();
    if (className.length > 0) {
      if (className.indexOf(' ') > -1) {
        var classes = className.split(/\s+/g);
        for (var i = 0,
            len = classes.length; i < len; i++) {
          this._renderer.setElementClass(this._ngEl, classes[i], enabled);
        }
      } else {
        this._renderer.setElementClass(this._ngEl, className, enabled);
      }
    }
  };
  NgClass = __decorate([core_1.Directive({
    selector: '[ngClass]',
    inputs: ['rawClass: ngClass', 'initialClasses: class']
  }), __metadata('design:paramtypes', [core_1.IterableDiffers, core_1.KeyValueDiffers, core_1.ElementRef, core_1.Renderer])], NgClass);
  return NgClass;
})();
exports.NgClass = NgClass;
