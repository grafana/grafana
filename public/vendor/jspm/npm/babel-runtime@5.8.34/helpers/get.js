/* */ 
"use strict";
var _Object$getOwnPropertyDescriptor = require('../core-js/object/get-own-property-descriptor')["default"];
exports["default"] = function get(_x, _x2, _x3) {
  var _again = true;
  _function: while (_again) {
    var object = _x,
        property = _x2,
        receiver = _x3;
    _again = false;
    if (object === null)
      object = Function.prototype;
    var desc = _Object$getOwnPropertyDescriptor(object, property);
    if (desc === undefined) {
      var parent = Object.getPrototypeOf(object);
      if (parent === null) {
        return undefined;
      } else {
        _x = parent;
        _x2 = property;
        _x3 = receiver;
        _again = true;
        desc = parent = undefined;
        continue _function;
      }
    } else if ("value" in desc) {
      return desc.value;
    } else {
      var getter = desc.get;
      if (getter === undefined) {
        return undefined;
      }
      return getter.call(receiver);
    }
  }
};
exports.__esModule = true;
