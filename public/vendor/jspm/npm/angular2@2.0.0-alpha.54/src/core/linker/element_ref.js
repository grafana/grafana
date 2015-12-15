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
var exceptions_1 = require('../../facade/exceptions');
var ElementRef = (function() {
  function ElementRef() {}
  Object.defineProperty(ElementRef.prototype, "nativeElement", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  ;
  Object.defineProperty(ElementRef.prototype, "renderView", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  return ElementRef;
})();
exports.ElementRef = ElementRef;
var ElementRef_ = (function(_super) {
  __extends(ElementRef_, _super);
  function ElementRef_(parentView, boundElementIndex, _renderer) {
    _super.call(this);
    this.parentView = parentView;
    this.boundElementIndex = boundElementIndex;
    this._renderer = _renderer;
  }
  Object.defineProperty(ElementRef_.prototype, "renderView", {
    get: function() {
      return this.parentView.render;
    },
    set: function(value) {
      exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ElementRef_.prototype, "nativeElement", {
    get: function() {
      return this._renderer.getNativeElementSync(this);
    },
    enumerable: true,
    configurable: true
  });
  return ElementRef_;
})(ElementRef);
exports.ElementRef_ = ElementRef_;
