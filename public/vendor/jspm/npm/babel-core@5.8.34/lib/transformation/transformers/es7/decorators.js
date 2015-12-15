/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersMemoiseDecorators = require("../../helpers/memoise-decorators");

var _helpersMemoiseDecorators2 = _interopRequireDefault(_helpersMemoiseDecorators);

var _helpersDefineMap = require("../../helpers/define-map");

var defineMap = _interopRequireWildcard(_helpersDefineMap);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  dependencies: ["es6.classes"],
  optional: true,
  stage: 1
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ObjectExpression: function ObjectExpression(node, parent, scope, file) {
    var hasDecorators = false;
    for (var i = 0; i < node.properties.length; i++) {
      var prop = node.properties[i];
      if (prop.decorators) {
        hasDecorators = true;
        break;
      }
    }
    if (!hasDecorators) return;

    var mutatorMap = {};

    for (var i = 0; i < node.properties.length; i++) {
      var prop = node.properties[i];
      if (prop.decorators) _helpersMemoiseDecorators2["default"](prop.decorators, scope);

      if (prop.kind === "init" && !prop.method) {
        prop.kind = "";
        prop.value = t.functionExpression(null, [], t.blockStatement([t.returnStatement(prop.value)]));
      }

      defineMap.push(mutatorMap, prop, "initializer", file);
    }

    var obj = defineMap.toClassObject(mutatorMap);
    obj = defineMap.toComputedObjectFromClass(obj);
    return t.callExpression(file.addHelper("create-decorated-object"), [obj]);
  }
};
exports.visitor = visitor;