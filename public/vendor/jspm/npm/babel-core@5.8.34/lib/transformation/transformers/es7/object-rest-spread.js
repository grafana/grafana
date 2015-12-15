/* */ 
"format cjs";
// https://github.com/sebmarkbage/ecmascript-rest-spread

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  stage: 2,
  dependencies: ["es6.destructuring"]
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var hasSpread = function hasSpread(node) {
  for (var i = 0; i < node.properties.length; i++) {
    if (t.isSpreadProperty(node.properties[i])) {
      return true;
    }
  }
  return false;
};

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ObjectExpression: function ObjectExpression(node, parent, scope, file) {
    if (!hasSpread(node)) return;

    var args = [];
    var props = [];

    var push = function push() {
      if (!props.length) return;
      args.push(t.objectExpression(props));
      props = [];
    };

    for (var i = 0; i < node.properties.length; i++) {
      var prop = node.properties[i];
      if (t.isSpreadProperty(prop)) {
        push();
        args.push(prop.argument);
      } else {
        props.push(prop);
      }
    }

    push();

    if (!t.isObjectExpression(args[0])) {
      args.unshift(t.objectExpression([]));
    }

    return t.callExpression(file.addHelper("extends"), args);
  }
};
exports.visitor = visitor;