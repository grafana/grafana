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
var lang_1 = require('../../../facade/lang');
var collection_1 = require('../../../facade/collection');
var di_1 = require('../../../core/di');
var view_listener_1 = require('../../../core/linker/view_listener');
var dom_adapter_1 = require('../dom_adapter');
var api_1 = require('../../../core/render/api');
var debug_element_1 = require('../../../core/debug/debug_element');
var NG_ID_PROPERTY = 'ngid';
var INSPECT_GLOBAL_NAME = 'ng.probe';
var NG_ID_SEPARATOR = '#';
var _allIdsByView = new collection_1.Map();
var _allViewsById = new collection_1.Map();
var _nextId = 0;
function _setElementId(element, indices) {
  if (lang_1.isPresent(element) && dom_adapter_1.DOM.isElementNode(element)) {
    dom_adapter_1.DOM.setData(element, NG_ID_PROPERTY, indices.join(NG_ID_SEPARATOR));
  }
}
function _getElementId(element) {
  var elId = dom_adapter_1.DOM.getData(element, NG_ID_PROPERTY);
  if (lang_1.isPresent(elId)) {
    return elId.split(NG_ID_SEPARATOR).map(function(partStr) {
      return lang_1.NumberWrapper.parseInt(partStr, 10);
    });
  } else {
    return null;
  }
}
function inspectNativeElement(element) {
  var elId = _getElementId(element);
  if (lang_1.isPresent(elId)) {
    var view = _allViewsById.get(elId[0]);
    if (lang_1.isPresent(view)) {
      return new debug_element_1.DebugElement_(view, elId[1]);
    }
  }
  return null;
}
exports.inspectNativeElement = inspectNativeElement;
var DebugElementViewListener = (function() {
  function DebugElementViewListener(_renderer) {
    this._renderer = _renderer;
    dom_adapter_1.DOM.setGlobalVar(INSPECT_GLOBAL_NAME, inspectNativeElement);
  }
  DebugElementViewListener.prototype.onViewCreated = function(view) {
    var viewId = _nextId++;
    _allViewsById.set(viewId, view);
    _allIdsByView.set(view, viewId);
    for (var i = 0; i < view.elementRefs.length; i++) {
      var el = view.elementRefs[i];
      _setElementId(this._renderer.getNativeElementSync(el), [viewId, i]);
    }
  };
  DebugElementViewListener.prototype.onViewDestroyed = function(view) {
    var viewId = _allIdsByView.get(view);
    _allIdsByView.delete(view);
    _allViewsById.delete(viewId);
  };
  DebugElementViewListener = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [api_1.Renderer])], DebugElementViewListener);
  return DebugElementViewListener;
})();
exports.DebugElementViewListener = DebugElementViewListener;
exports.ELEMENT_PROBE_PROVIDERS = lang_1.CONST_EXPR([DebugElementViewListener, lang_1.CONST_EXPR(new di_1.Provider(view_listener_1.AppViewListener, {useExisting: DebugElementViewListener}))]);
exports.ELEMENT_PROBE_BINDINGS = exports.ELEMENT_PROBE_PROVIDERS;
