/* */ 
"use strict";
var _promise = require('../core-js/promise');
var _promise2 = _interopRequireDefault(_promise);
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {default: obj};
}
exports.default = function(fn) {
  return function() {
    var gen = fn.apply(this, arguments);
    return new _promise2.default(function(resolve, reject) {
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
          _promise2.default.resolve(value).then(callNext, callThrow);
        }
      }
      callNext();
    });
  };
};
exports.__esModule = true;
