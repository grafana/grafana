/* */ 
"use strict";
var _Object$defineProperty = require('../core-js/object/define-property')["default"];
exports["default"] = function(target, key, descriptors) {
  var _descriptor = descriptors[key];
  if (!_descriptor)
    return;
  var descriptor = {};
  for (var _key in _descriptor)
    descriptor[_key] = _descriptor[_key];
  descriptor.value = descriptor.initializer ? descriptor.initializer.call(target) : undefined;
  _Object$defineProperty(target, key, descriptor);
};
exports.__esModule = true;
