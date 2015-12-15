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
function internalView(viewRef) {
  return viewRef._view;
}
exports.internalView = internalView;
function internalProtoView(protoViewRef) {
  return lang_1.isPresent(protoViewRef) ? protoViewRef._protoView : null;
}
exports.internalProtoView = internalProtoView;
var ViewRef = (function() {
  function ViewRef() {}
  Object.defineProperty(ViewRef.prototype, "changeDetectorRef", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    set: function(value) {
      exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  return ViewRef;
})();
exports.ViewRef = ViewRef;
var ViewRef_ = (function(_super) {
  __extends(ViewRef_, _super);
  function ViewRef_(_view) {
    _super.call(this);
    this._changeDetectorRef = null;
    this._view = _view;
  }
  Object.defineProperty(ViewRef_.prototype, "render", {
    get: function() {
      return this._view.render;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ViewRef_.prototype, "renderFragment", {
    get: function() {
      return this._view.renderFragment;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ViewRef_.prototype, "changeDetectorRef", {
    get: function() {
      if (this._changeDetectorRef === null) {
        this._changeDetectorRef = this._view.changeDetector.ref;
      }
      return this._changeDetectorRef;
    },
    enumerable: true,
    configurable: true
  });
  ViewRef_.prototype.setLocal = function(variableName, value) {
    this._view.setLocal(variableName, value);
  };
  return ViewRef_;
})(ViewRef);
exports.ViewRef_ = ViewRef_;
var ProtoViewRef = (function() {
  function ProtoViewRef() {}
  return ProtoViewRef;
})();
exports.ProtoViewRef = ProtoViewRef;
var ProtoViewRef_ = (function(_super) {
  __extends(ProtoViewRef_, _super);
  function ProtoViewRef_(_protoView) {
    _super.call(this);
    this._protoView = _protoView;
  }
  return ProtoViewRef_;
})(ProtoViewRef);
exports.ProtoViewRef_ = ProtoViewRef_;
