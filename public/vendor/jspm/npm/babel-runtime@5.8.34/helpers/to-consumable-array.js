/* */ 
"use strict";
var _Array$from = require('../core-js/array/from')["default"];
exports["default"] = function(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0,
        arr2 = Array(arr.length); i < arr.length; i++)
      arr2[i] = arr[i];
    return arr2;
  } else {
    return _Array$from(arr);
  }
};
exports.__esModule = true;
