/* */ 
"use strict";
var _Object$assign = require('../core-js/object/assign')["default"];
exports["default"] = _Object$assign || function(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }
  return target;
};
exports.__esModule = true;
