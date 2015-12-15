/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-trailing"
};

exports.metadata = metadata;
function shouldShadow(path, shadowPath) {
  if (path.is("_forceShadow")) {
    return true;
  } else {
    return shadowPath && !shadowPath.isArrowFunctionExpression();
  }
}

/**
 * [Please add a description.]
 */

function remap(path, key, create) {
  // ensure that we're shadowed
  var shadowPath = path.inShadow(key);
  if (!shouldShadow(path, shadowPath)) return;

  var shadowFunction = path.node._shadowedFunctionLiteral;
  var currentFunction;

  var fnPath = path.findParent(function (path) {
    if (path.isProgram() || path.isFunction()) {
      // catch current function in case this is the shadowed one and we can ignore it
      currentFunction = currentFunction || path;
    }

    if (path.isProgram()) {
      return true;
    } else if (path.isFunction()) {
      if (shadowFunction) {
        return path === shadowFunction || path.node === shadowFunction.node;
      } else {
        return !path.is("shadow");
      }
    }

    return false;
  });

  // no point in realiasing if we're in this function
  if (fnPath === currentFunction) return;

  var cached = fnPath.getData(key);
  if (cached) return cached;

  var init = create();
  var id = path.scope.generateUidIdentifier(key);

  fnPath.setData(key, id);
  fnPath.scope.push({ id: id, init: init });

  return id;
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ThisExpression: function ThisExpression() {
    return remap(this, "this", function () {
      return t.thisExpression();
    });
  },

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node) {
    if (node.name === "arguments") {
      return remap(this, "arguments", function () {
        return t.identifier("arguments");
      });
    }
  }
};
exports.visitor = visitor;