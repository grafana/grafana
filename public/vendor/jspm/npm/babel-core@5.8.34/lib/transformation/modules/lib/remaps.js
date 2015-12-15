/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var remapVisitor = {

  /**
   * [Please add a description.]
   */

  enter: function enter(node) {
    if (node._skipModulesRemap) {
      return this.skip();
    }
  },

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node, parent, scope, remaps) {
    var formatter = remaps.formatter;

    var remap = remaps.get(scope, node.name);
    if (!remap || node === remap) return;

    if (!scope.hasBinding(node.name) || scope.bindingIdentifierEquals(node.name, formatter.localImports[node.name])) {
      if (!formatter.isLoose() && this.key === "callee" && this.parentPath.isCallExpression()) {
        return t.sequenceExpression([t.literal(0), remap]);
      } else {
        return remap;
      }
    }
  },

  /**
   * [Please add a description.]
   */

  AssignmentExpression: {
    exit: function exit(node, parent, scope, _ref) {
      var formatter = _ref.formatter;

      if (!node._ignoreModulesRemap) {
        var exported = formatter.getExport(node.left, scope);
        if (exported) {
          return formatter.remapExportAssignment(node, exported);
        }
      }
    }
  },

  /**
   * [Please add a description.]
   */

  UpdateExpression: function UpdateExpression(node, parent, scope, _ref2) {
    var formatter = _ref2.formatter;

    var exported = formatter.getExport(node.argument, scope);
    if (!exported) return;

    this.skip();

    // expand to long file assignment expression
    var assign = t.assignmentExpression(node.operator[0] + "=", node.argument, t.literal(1));

    // remap this assignment expression
    var remapped = formatter.remapExportAssignment(assign, exported);

    // we don't need to change the result
    if (t.isExpressionStatement(parent) || node.prefix) {
      return remapped;
    }

    var nodes = [];
    nodes.push(remapped);

    var operator;
    if (node.operator === "--") {
      operator = "+";
    } else {
      // "++"
      operator = "-";
    }
    nodes.push(t.binaryExpression(operator, node.argument, t.literal(1)));

    return t.sequenceExpression(nodes);
  }
};

/**
 * [Please add a description.]
 */

var Remaps = (function () {
  function Remaps(file, formatter) {
    _classCallCheck(this, Remaps);

    this.formatter = formatter;
    this.file = file;
  }

  /**
   * [Please add a description.]
   */

  Remaps.prototype.run = function run() {
    this.file.path.traverse(remapVisitor, this);
  };

  /**
   * [Please add a description.]
   */

  Remaps.prototype._getKey = function _getKey(name) {
    return name + ":moduleRemap";
  };

  /**
   * [Please add a description.]
   */

  Remaps.prototype.get = function get(scope, name) {
    return scope.getData(this._getKey(name));
  };

  /**
   * [Please add a description.]
   */

  Remaps.prototype.add = function add(scope, name, val) {
    if (this.all) {
      this.all.push({
        name: name,
        scope: scope,
        node: val
      });
    }

    return scope.setData(this._getKey(name), val);
  };

  /**
   * [Please add a description.]
   */

  Remaps.prototype.remove = function remove(scope, name) {
    return scope.removeData(this._getKey(name));
  };

  /**
   * These methods are used by the system module formatter who needs access to all the remaps
   * so it can process them into it's specific setter method. We don't do this by default since
   * no other module formatters need access to this.
   */

  Remaps.prototype.getAll = function getAll() {
    return this.all;
  };

  /**
   * [Please add a description.]
   */

  Remaps.prototype.clearAll = function clearAll() {
    if (this.all) {
      var _arr = this.all;

      for (var _i = 0; _i < _arr.length; _i++) {
        var remap = _arr[_i];
        remap.scope.removeData(this._getKey(remap.name));
      }
    }

    this.all = [];
  };

  return Remaps;
})();

exports["default"] = Remaps;
module.exports = exports["default"];