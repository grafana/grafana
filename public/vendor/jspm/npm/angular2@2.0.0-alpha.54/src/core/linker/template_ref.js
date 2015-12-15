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
var view_ref_1 = require('./view_ref');
var TemplateRef = (function() {
  function TemplateRef() {}
  return TemplateRef;
})();
exports.TemplateRef = TemplateRef;
var TemplateRef_ = (function(_super) {
  __extends(TemplateRef_, _super);
  function TemplateRef_(elementRef) {
    _super.call(this);
    this.elementRef = elementRef;
  }
  TemplateRef_.prototype._getProtoView = function() {
    var elementRef = this.elementRef;
    var parentView = view_ref_1.internalView(elementRef.parentView);
    return parentView.proto.elementBinders[elementRef.boundElementIndex - parentView.elementOffset].nestedProtoView;
  };
  Object.defineProperty(TemplateRef_.prototype, "protoViewRef", {
    get: function() {
      return this._getProtoView().ref;
    },
    enumerable: true,
    configurable: true
  });
  TemplateRef_.prototype.hasLocal = function(name) {
    return this._getProtoView().templateVariableBindings.has(name);
  };
  return TemplateRef_;
})(TemplateRef);
exports.TemplateRef_ = TemplateRef_;
