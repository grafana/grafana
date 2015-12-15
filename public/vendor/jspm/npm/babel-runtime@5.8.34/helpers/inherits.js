/* */ 
"use strict";
var _Object$create = require('../core-js/object/create')["default"];
var _Object$setPrototypeOf = require('../core-js/object/set-prototype-of')["default"];
exports["default"] = function(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = _Object$create(superClass && superClass.prototype, {constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }});
  if (superClass)
    _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};
exports.__esModule = true;
