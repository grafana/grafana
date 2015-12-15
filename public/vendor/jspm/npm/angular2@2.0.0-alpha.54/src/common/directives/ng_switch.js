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
var core_1 = require('../../../core');
var lang_1 = require('../../facade/lang');
var collection_1 = require('../../facade/collection');
var _WHEN_DEFAULT = lang_1.CONST_EXPR(new Object());
var SwitchView = (function() {
  function SwitchView(_viewContainerRef, _templateRef) {
    this._viewContainerRef = _viewContainerRef;
    this._templateRef = _templateRef;
  }
  SwitchView.prototype.create = function() {
    this._viewContainerRef.createEmbeddedView(this._templateRef);
  };
  SwitchView.prototype.destroy = function() {
    this._viewContainerRef.clear();
  };
  return SwitchView;
})();
var NgSwitch = (function() {
  function NgSwitch() {
    this._useDefault = false;
    this._valueViews = new collection_1.Map();
    this._activeViews = [];
  }
  Object.defineProperty(NgSwitch.prototype, "ngSwitch", {
    set: function(value) {
      this._emptyAllActiveViews();
      this._useDefault = false;
      var views = this._valueViews.get(value);
      if (lang_1.isBlank(views)) {
        this._useDefault = true;
        views = lang_1.normalizeBlank(this._valueViews.get(_WHEN_DEFAULT));
      }
      this._activateViews(views);
      this._switchValue = value;
    },
    enumerable: true,
    configurable: true
  });
  NgSwitch.prototype._onWhenValueChanged = function(oldWhen, newWhen, view) {
    this._deregisterView(oldWhen, view);
    this._registerView(newWhen, view);
    if (oldWhen === this._switchValue) {
      view.destroy();
      collection_1.ListWrapper.remove(this._activeViews, view);
    } else if (newWhen === this._switchValue) {
      if (this._useDefault) {
        this._useDefault = false;
        this._emptyAllActiveViews();
      }
      view.create();
      this._activeViews.push(view);
    }
    if (this._activeViews.length === 0 && !this._useDefault) {
      this._useDefault = true;
      this._activateViews(this._valueViews.get(_WHEN_DEFAULT));
    }
  };
  NgSwitch.prototype._emptyAllActiveViews = function() {
    var activeContainers = this._activeViews;
    for (var i = 0; i < activeContainers.length; i++) {
      activeContainers[i].destroy();
    }
    this._activeViews = [];
  };
  NgSwitch.prototype._activateViews = function(views) {
    if (lang_1.isPresent(views)) {
      for (var i = 0; i < views.length; i++) {
        views[i].create();
      }
      this._activeViews = views;
    }
  };
  NgSwitch.prototype._registerView = function(value, view) {
    var views = this._valueViews.get(value);
    if (lang_1.isBlank(views)) {
      views = [];
      this._valueViews.set(value, views);
    }
    views.push(view);
  };
  NgSwitch.prototype._deregisterView = function(value, view) {
    if (value === _WHEN_DEFAULT)
      return;
    var views = this._valueViews.get(value);
    if (views.length == 1) {
      this._valueViews.delete(value);
    } else {
      collection_1.ListWrapper.remove(views, view);
    }
  };
  NgSwitch = __decorate([core_1.Directive({
    selector: '[ngSwitch]',
    inputs: ['ngSwitch']
  }), __metadata('design:paramtypes', [])], NgSwitch);
  return NgSwitch;
})();
exports.NgSwitch = NgSwitch;
var NgSwitchWhen = (function() {
  function NgSwitchWhen(viewContainer, templateRef, ngSwitch) {
    this._value = _WHEN_DEFAULT;
    this._switch = ngSwitch;
    this._view = new SwitchView(viewContainer, templateRef);
  }
  Object.defineProperty(NgSwitchWhen.prototype, "ngSwitchWhen", {
    set: function(value) {
      this._switch._onWhenValueChanged(this._value, value, this._view);
      this._value = value;
    },
    enumerable: true,
    configurable: true
  });
  NgSwitchWhen = __decorate([core_1.Directive({
    selector: '[ngSwitchWhen]',
    inputs: ['ngSwitchWhen']
  }), __param(2, core_1.Host()), __metadata('design:paramtypes', [core_1.ViewContainerRef, core_1.TemplateRef, NgSwitch])], NgSwitchWhen);
  return NgSwitchWhen;
})();
exports.NgSwitchWhen = NgSwitchWhen;
var NgSwitchDefault = (function() {
  function NgSwitchDefault(viewContainer, templateRef, sswitch) {
    sswitch._registerView(_WHEN_DEFAULT, new SwitchView(viewContainer, templateRef));
  }
  NgSwitchDefault = __decorate([core_1.Directive({selector: '[ngSwitchDefault]'}), __param(2, core_1.Host()), __metadata('design:paramtypes', [core_1.ViewContainerRef, core_1.TemplateRef, NgSwitch])], NgSwitchDefault);
  return NgSwitchDefault;
})();
exports.NgSwitchDefault = NgSwitchDefault;
