/* */ 
"use strict";
var _Promise = require('../core-js/promise')["default"];
exports["default"] = function(fn) {
  return function() {
    var gen = fn.apply(this, arguments);
    return new _Promise(function(resolve, reject) {
      var callNext = step.bind(null, "next");
      var callThrow = step.bind(null, "throw");
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }
        if (info.done) {
          resolve(value);
        } else {
          _Promise.resolve(value).then(callNext, callThrow);
        }
      }
      callNext();
    });
  };
};
exports.__esModule = true;
