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
var exceptions_1 = require('../../facade/exceptions');
var view_1 = require('../linker/view');
var view_ref_1 = require('../linker/view_ref');
var DebugElement = (function() {
  function DebugElement() {}
  Object.defineProperty(DebugElement.prototype, "componentInstance", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(DebugElement.prototype, "nativeElement", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(DebugElement.prototype, "elementRef", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(DebugElement.prototype, "children", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(DebugElement.prototype, "componentViewChildren", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  DebugElement.prototype.query = function(predicate, scope) {
    if (scope === void 0) {
      scope = Scope.all;
    }
    var results = this.queryAll(predicate, scope);
    return results.length > 0 ? results[0] : null;
  };
  DebugElement.prototype.queryAll = function(predicate, scope) {
    if (scope === void 0) {
      scope = Scope.all;
    }
    var elementsInScope = scope(this);
    return elementsInScope.filter(predicate);
  };
  return DebugElement;
})();
exports.DebugElement = DebugElement;
var DebugElement_ = (function(_super) {
  __extends(DebugElement_, _super);
  function DebugElement_(_parentView, _boundElementIndex) {
    _super.call(this);
    this._parentView = _parentView;
    this._boundElementIndex = _boundElementIndex;
    this._elementInjector = this._parentView.elementInjectors[this._boundElementIndex];
  }
  Object.defineProperty(DebugElement_.prototype, "componentInstance", {
    get: function() {
      if (!lang_1.isPresent(this._elementInjector)) {
        return null;
      }
      return this._elementInjector.getComponent();
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DebugElement_.prototype, "nativeElement", {
    get: function() {
      return this.elementRef.nativeElement;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DebugElement_.prototype, "elementRef", {
    get: function() {
      return this._parentView.elementRefs[this._boundElementIndex];
    },
    enumerable: true,
    configurable: true
  });
  DebugElement_.prototype.getDirectiveInstance = function(directiveIndex) {
    return this._elementInjector.getDirectiveAtIndex(directiveIndex);
  };
  Object.defineProperty(DebugElement_.prototype, "children", {
    get: function() {
      return this._getChildElements(this._parentView, this._boundElementIndex);
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DebugElement_.prototype, "componentViewChildren", {
    get: function() {
      var shadowView = this._parentView.getNestedView(this._boundElementIndex);
      if (!lang_1.isPresent(shadowView) || shadowView.proto.type !== view_1.ViewType.COMPONENT) {
        return [];
      }
      return this._getChildElements(shadowView, null);
    },
    enumerable: true,
    configurable: true
  });
  DebugElement_.prototype.triggerEventHandler = function(eventName, eventObj) {
    this._parentView.triggerEventHandlers(eventName, eventObj, this._boundElementIndex);
  };
  DebugElement_.prototype.hasDirective = function(type) {
    if (!lang_1.isPresent(this._elementInjector)) {
      return false;
    }
    return this._elementInjector.hasDirective(type);
  };
  DebugElement_.prototype.inject = function(type) {
    if (!lang_1.isPresent(this._elementInjector)) {
      return null;
    }
    return this._elementInjector.get(type);
  };
  DebugElement_.prototype.getLocal = function(name) {
    return this._parentView.locals.get(name);
  };
  DebugElement_.prototype._getChildElements = function(view, parentBoundElementIndex) {
    var _this = this;
    var els = [];
    var parentElementBinder = null;
    if (lang_1.isPresent(parentBoundElementIndex)) {
      parentElementBinder = view.proto.elementBinders[parentBoundElementIndex - view.elementOffset];
    }
    for (var i = 0; i < view.proto.elementBinders.length; ++i) {
      var binder = view.proto.elementBinders[i];
      if (binder.parent == parentElementBinder) {
        els.push(new DebugElement_(view, view.elementOffset + i));
        var views = view.viewContainers[view.elementOffset + i];
        if (lang_1.isPresent(views)) {
          views.views.forEach(function(nextView) {
            els = els.concat(_this._getChildElements(nextView, null));
          });
        }
      }
    }
    return els;
  };
  return DebugElement_;
})(DebugElement);
exports.DebugElement_ = DebugElement_;
function inspectElement(elementRef) {
  return new DebugElement_(view_ref_1.internalView(elementRef.parentView), elementRef.boundElementIndex);
}
exports.inspectElement = inspectElement;
function asNativeElements(arr) {
  return arr.map(function(debugEl) {
    return debugEl.nativeElement;
  });
}
exports.asNativeElements = asNativeElements;
var Scope = (function() {
  function Scope() {}
  Scope.all = function(debugElement) {
    var scope = [];
    scope.push(debugElement);
    debugElement.children.forEach(function(child) {
      return scope = scope.concat(Scope.all(child));
    });
    debugElement.componentViewChildren.forEach(function(child) {
      return scope = scope.concat(Scope.all(child));
    });
    return scope;
  };
  Scope.light = function(debugElement) {
    var scope = [];
    debugElement.children.forEach(function(child) {
      scope.push(child);
      scope = scope.concat(Scope.light(child));
    });
    return scope;
  };
  Scope.view = function(debugElement) {
    var scope = [];
    debugElement.componentViewChildren.forEach(function(child) {
      scope.push(child);
      scope = scope.concat(Scope.light(child));
    });
    return scope;
  };
  return Scope;
})();
exports.Scope = Scope;
