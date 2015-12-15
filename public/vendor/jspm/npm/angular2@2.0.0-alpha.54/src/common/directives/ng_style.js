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
var core_1 = require('../../../core');
var lang_1 = require('../../facade/lang');
var NgStyle = (function() {
  function NgStyle(_differs, _ngEl, _renderer) {
    this._differs = _differs;
    this._ngEl = _ngEl;
    this._renderer = _renderer;
  }
  Object.defineProperty(NgStyle.prototype, "rawStyle", {
    set: function(v) {
      this._rawStyle = v;
      if (lang_1.isBlank(this._differ) && lang_1.isPresent(v)) {
        this._differ = this._differs.find(this._rawStyle).create(null);
      }
    },
    enumerable: true,
    configurable: true
  });
  NgStyle.prototype.ngDoCheck = function() {
    if (lang_1.isPresent(this._differ)) {
      var changes = this._differ.diff(this._rawStyle);
      if (lang_1.isPresent(changes)) {
        this._applyChanges(changes);
      }
    }
  };
  NgStyle.prototype._applyChanges = function(changes) {
    var _this = this;
    changes.forEachAddedItem(function(record) {
      _this._setStyle(record.key, record.currentValue);
    });
    changes.forEachChangedItem(function(record) {
      _this._setStyle(record.key, record.currentValue);
    });
    changes.forEachRemovedItem(function(record) {
      _this._setStyle(record.key, null);
    });
  };
  NgStyle.prototype._setStyle = function(name, val) {
    this._renderer.setElementStyle(this._ngEl, name, val);
  };
  NgStyle = __decorate([core_1.Directive({
    selector: '[ngStyle]',
    inputs: ['rawStyle: ngStyle']
  }), __metadata('design:paramtypes', [core_1.KeyValueDiffers, core_1.ElementRef, core_1.Renderer])], NgStyle);
  return NgStyle;
})();
exports.NgStyle = NgStyle;
