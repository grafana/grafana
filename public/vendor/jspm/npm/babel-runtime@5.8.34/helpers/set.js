/* */ 
"use strict";
var _Object$getOwnPropertyDescriptor = require('../core-js/object/get-own-property-descriptor')["default"];
exports["default"] = function set(object, property, value, receiver) {
  var desc = _Object$getOwnPropertyDescriptor(object, property);
  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);
    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;
    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }
  return value;
};
exports.__esModule = true;
