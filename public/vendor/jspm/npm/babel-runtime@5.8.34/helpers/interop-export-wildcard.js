/* */ 
"use strict";

exports["default"] = function (obj, defaults) {
  var newObj = defaults({}, obj);
  delete newObj["default"];
  return newObj;
};

exports.__esModule = true;