/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashObjectMerge = require("lodash/object/merge");

var _lodashObjectMerge2 = _interopRequireDefault(_lodashObjectMerge);

/**
 * Merge options.
 */

exports["default"] = function (dest, src) {
  if (!dest || !src) return;

  return _lodashObjectMerge2["default"](dest, src, function (a, b) {
    if (b && Array.isArray(a)) {
      var c = a.slice(0);
      for (var _iterator = b, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        var v = _ref;

        if (a.indexOf(v) < 0) {
          c.push(v);
        }
      }
      return c;
    }
  });
};

module.exports = exports["default"];