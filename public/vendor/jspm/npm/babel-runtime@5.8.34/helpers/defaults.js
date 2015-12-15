/* */ 
"use strict";
var _Object$getOwnPropertyNames = require('../core-js/object/get-own-property-names')["default"];
var _Object$getOwnPropertyDescriptor = require('../core-js/object/get-own-property-descriptor')["default"];
var _Object$defineProperty = require('../core-js/object/define-property')["default"];
exports["default"] = function(obj, defaults) {
  var keys = _Object$getOwnPropertyNames(defaults);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = _Object$getOwnPropertyDescriptor(defaults, key);
    if (value && value.configurable && obj[key] === undefined) {
      _Object$defineProperty(obj, key, value);
    }
  }
  return obj;
};
exports.__esModule = true;
