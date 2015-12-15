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
var core_1 = require('../../core');
var lang_1 = require('../facade/lang');
var collection_1 = require('../facade/collection');
var view_ref_1 = require('../core/linker/view_ref');
var utils_1 = require('./utils');
var dom_tokens_1 = require('../platform/dom/dom_tokens');
var dom_adapter_1 = require('../platform/dom/dom_adapter');
var debug_element_1 = require('../core/debug/debug_element');
var ComponentFixture = (function() {
  function ComponentFixture() {}
  return ComponentFixture;
})();
exports.ComponentFixture = ComponentFixture;
var ComponentFixture_ = (function(_super) {
  __extends(ComponentFixture_, _super);
  function ComponentFixture_(componentRef) {
    _super.call(this);
    this.debugElement = new debug_element_1.DebugElement_(view_ref_1.internalView(componentRef.hostView), 0);
    this.componentInstance = this.debugElement.componentInstance;
    this.nativeElement = this.debugElement.nativeElement;
    this._componentParentView = view_ref_1.internalView(componentRef.hostView);
    this._componentRef = componentRef;
  }
  ComponentFixture_.prototype.detectChanges = function() {
    this._componentParentView.changeDetector.detectChanges();
    this._componentParentView.changeDetector.checkNoChanges();
  };
  ComponentFixture_.prototype.destroy = function() {
    this._componentRef.dispose();
  };
  return ComponentFixture_;
})(ComponentFixture);
exports.ComponentFixture_ = ComponentFixture_;
var _nextRootElementId = 0;
var TestComponentBuilder = (function() {
  function TestComponentBuilder(_injector) {
    this._injector = _injector;
    this._bindingsOverrides = new Map();
    this._directiveOverrides = new Map();
    this._templateOverrides = new Map();
    this._viewBindingsOverrides = new Map();
    this._viewOverrides = new Map();
  }
  TestComponentBuilder.prototype._clone = function() {
    var clone = new TestComponentBuilder(this._injector);
    clone._viewOverrides = collection_1.MapWrapper.clone(this._viewOverrides);
    clone._directiveOverrides = collection_1.MapWrapper.clone(this._directiveOverrides);
    clone._templateOverrides = collection_1.MapWrapper.clone(this._templateOverrides);
    return clone;
  };
  TestComponentBuilder.prototype.overrideTemplate = function(componentType, template) {
    var clone = this._clone();
    clone._templateOverrides.set(componentType, template);
    return clone;
  };
  TestComponentBuilder.prototype.overrideView = function(componentType, view) {
    var clone = this._clone();
    clone._viewOverrides.set(componentType, view);
    return clone;
  };
  TestComponentBuilder.prototype.overrideDirective = function(componentType, from, to) {
    var clone = this._clone();
    var overridesForComponent = clone._directiveOverrides.get(componentType);
    if (!lang_1.isPresent(overridesForComponent)) {
      clone._directiveOverrides.set(componentType, new Map());
      overridesForComponent = clone._directiveOverrides.get(componentType);
    }
    overridesForComponent.set(from, to);
    return clone;
  };
  TestComponentBuilder.prototype.overrideProviders = function(type, providers) {
    var clone = this._clone();
    clone._bindingsOverrides.set(type, providers);
    return clone;
  };
  TestComponentBuilder.prototype.overrideBindings = function(type, providers) {
    return this.overrideProviders(type, providers);
  };
  TestComponentBuilder.prototype.overrideViewProviders = function(type, providers) {
    var clone = this._clone();
    clone._viewBindingsOverrides.set(type, providers);
    return clone;
  };
  TestComponentBuilder.prototype.overrideViewBindings = function(type, providers) {
    return this.overrideViewProviders(type, providers);
  };
  TestComponentBuilder.prototype.createAsync = function(rootComponentType) {
    var mockDirectiveResolver = this._injector.get(core_1.DirectiveResolver);
    var mockViewResolver = this._injector.get(core_1.ViewResolver);
    this._viewOverrides.forEach(function(view, type) {
      return mockViewResolver.setView(type, view);
    });
    this._templateOverrides.forEach(function(template, type) {
      return mockViewResolver.setInlineTemplate(type, template);
    });
    this._directiveOverrides.forEach(function(overrides, component) {
      overrides.forEach(function(to, from) {
        mockViewResolver.overrideViewDirective(component, from, to);
      });
    });
    this._bindingsOverrides.forEach(function(bindings, type) {
      return mockDirectiveResolver.setBindingsOverride(type, bindings);
    });
    this._viewBindingsOverrides.forEach(function(bindings, type) {
      return mockDirectiveResolver.setViewBindingsOverride(type, bindings);
    });
    var rootElId = "root" + _nextRootElementId++;
    var rootEl = utils_1.el("<div id=\"" + rootElId + "\"></div>");
    var doc = this._injector.get(dom_tokens_1.DOCUMENT);
    var oldRoots = dom_adapter_1.DOM.querySelectorAll(doc, '[id^=root]');
    for (var i = 0; i < oldRoots.length; i++) {
      dom_adapter_1.DOM.remove(oldRoots[i]);
    }
    dom_adapter_1.DOM.appendChild(doc.body, rootEl);
    return this._injector.get(core_1.DynamicComponentLoader).loadAsRoot(rootComponentType, "#" + rootElId, this._injector).then(function(componentRef) {
      return new ComponentFixture_(componentRef);
    });
  };
  TestComponentBuilder = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [core_1.Injector])], TestComponentBuilder);
  return TestComponentBuilder;
})();
exports.TestComponentBuilder = TestComponentBuilder;
