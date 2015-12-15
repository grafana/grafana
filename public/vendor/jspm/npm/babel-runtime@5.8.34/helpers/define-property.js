/* */ 
"use strict";
var _Object$defineProperty = require('../core-js/object/define-property')["default"];
exports["default"] = function(obj, key, value) {
  if (key in obj) {
    _Object$defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
};
exports.__esModule = true;
