/* */ 
"use strict";
var _Object$defineProperty = require('../core-js/object/define-property')["default"];
exports["default"] = function(descriptors) {
  var target = {};
  for (var i = 0; i < descriptors.length; i++) {
    var descriptor = descriptors[i];
    var decorators = descriptor.decorators;
    var key = descriptor.key;
    delete descriptor.key;
    delete descriptor.decorators;
    descriptor.enumerable = true;
    descriptor.configurable = true;
    if ("value" in descriptor || descriptor.initializer)
      descriptor.writable = true;
    if (decorators) {
      for (var f = 0; f < decorators.length; f++) {
        var decorator = decorators[f];
        if (typeof decorator === "function") {
          descriptor = decorator(target, key, descriptor) || descriptor;
        } else {
          throw new TypeError("The decorator for method " + descriptor.key + " is of the invalid type " + typeof decorator);
        }
      }
    }
    if (descriptor.initializer) {
      descriptor.value = descriptor.initializer.call(target);
    }
    _Object$defineProperty(target, key, descriptor);
  }
  return target;
};
exports.__esModule = true;
