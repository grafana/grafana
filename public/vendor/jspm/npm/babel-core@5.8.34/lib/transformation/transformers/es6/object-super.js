/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersReplaceSupers = require("../../helpers/replace-supers");

var _helpersReplaceSupers2 = _interopRequireDefault(_helpersReplaceSupers);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function Property(path, node, scope, getObjectRef, file) {
  if (!node.method && node.kind === "init") return;
  if (!t.isFunction(node.value)) return;

  var replaceSupers = new _helpersReplaceSupers2["default"]({
    getObjectRef: getObjectRef,
    methodNode: node,
    methodPath: path,
    isStatic: true,
    scope: scope,
    file: file
  });

  replaceSupers.replace();
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ObjectExpression: function ObjectExpression(node, parent, scope, file) {
    var objectRef;
    var getObjectRef = function getObjectRef() {
      return objectRef = objectRef || scope.generateUidIdentifier("obj");
    };

    var propPaths = this.get("properties");
    for (var i = 0; i < node.properties.length; i++) {
      Property(propPaths[i], node.properties[i], scope, getObjectRef, file);
    }

    if (objectRef) {
      scope.push({ id: objectRef });
      return t.assignmentExpression("=", objectRef, node);
    }
  }
};
exports.visitor = visitor;