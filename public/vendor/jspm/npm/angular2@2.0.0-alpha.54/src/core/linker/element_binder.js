/* */ 
'use strict';
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
var ElementBinder = (function() {
  function ElementBinder(index, parent, distanceToParent, protoElementInjector, componentDirective, nestedProtoView) {
    this.index = index;
    this.parent = parent;
    this.distanceToParent = distanceToParent;
    this.protoElementInjector = protoElementInjector;
    this.componentDirective = componentDirective;
    this.nestedProtoView = nestedProtoView;
    if (lang_1.isBlank(index)) {
      throw new exceptions_1.BaseException('null index not allowed.');
    }
  }
  return ElementBinder;
})();
exports.ElementBinder = ElementBinder;
