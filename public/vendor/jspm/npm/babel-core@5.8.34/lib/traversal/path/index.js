/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _libVirtualTypes = require("./lib/virtual-types");

var virtualTypes = _interopRequireWildcard(_libVirtualTypes);

var _index = require("../index");

var _index2 = _interopRequireDefault(_index);

var _lodashObjectAssign = require("lodash/object/assign");

var _lodashObjectAssign2 = _interopRequireDefault(_lodashObjectAssign);

var _scope = require("../scope");

var _scope2 = _interopRequireDefault(_scope);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var NodePath = (function () {

  /**
   * [Please add a description.]
   */

  function NodePath(hub, parent) {
    _classCallCheck(this, NodePath);

    this.contexts = [];
    this.parent = parent;
    this.data = {};
    this.hub = hub;

    this.shouldSkip = false;
    this.shouldStop = false;
    this.removed = false;
    this.state = null;
    this.opts = null;
    this.skipKeys = null;
    this.parentPath = null;
    this.context = null;
    this.container = null;
    this.listKey = null;
    this.inList = false;
    this.parentKey = null;
    this.key = null;
    this.node = null;
    this.scope = null;
    this.type = null;
    this.typeAnnotation = null;
  }

  /**
   * [Please add a description.]
   */

  /**
   * [Please add a description.]
   */

  NodePath.get = function get(_ref) {
    var hub = _ref.hub;
    var parentPath = _ref.parentPath;
    var parent = _ref.parent;
    var container = _ref.container;
    var listKey = _ref.listKey;
    var key = _ref.key;

    if (!hub && parentPath) {
      hub = parentPath.hub;
    }

    var targetNode = container[key];
    var paths = parent._paths = parent._paths || [];
    var path;

    for (var i = 0; i < paths.length; i++) {
      var pathCheck = paths[i];
      if (pathCheck.node === targetNode) {
        path = pathCheck;
        break;
      }
    }

    if (!path) {
      path = new NodePath(hub, parent);
      paths.push(path);
    }

    path.setup(parentPath, container, listKey, key);

    return path;
  };

  /**
   * [Please add a description.]
   */

  NodePath.prototype.getScope = function getScope(scope) {
    var ourScope = scope;

    // we're entering a new scope so let's construct it!
    if (this.isScope()) {
      ourScope = new _scope2["default"](this, scope);
    }

    return ourScope;
  };

  /**
   * [Please add a description.]
   */

  NodePath.prototype.setData = function setData(key, val) {
    return this.data[key] = val;
  };

  /**
   * [Please add a description.]
   */

  NodePath.prototype.getData = function getData(key, def) {
    var val = this.data[key];
    if (!val && def) val = this.data[key] = def;
    return val;
  };

  /**
   * [Please add a description.]
   */

  NodePath.prototype.errorWithNode = function errorWithNode(msg) {
    var Error = arguments.length <= 1 || arguments[1] === undefined ? SyntaxError : arguments[1];

    return this.hub.file.errorWithNode(this.node, msg, Error);
  };

  /**
   * [Please add a description.]
   */

  NodePath.prototype.traverse = function traverse(visitor, state) {
    _index2["default"](this.node, visitor, this.scope, state, this);
  };

  return NodePath;
})();

exports["default"] = NodePath;
_lodashObjectAssign2["default"](NodePath.prototype, require("./ancestry"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./inference"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./replacement"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./evaluation"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./conversion"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./introspection"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./context"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./removal"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./modification"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./family"));
_lodashObjectAssign2["default"](NodePath.prototype, require("./comments"));

var _arr = t.TYPES;

var _loop = function () {
  var type = _arr[_i];
  var typeKey = "is" + type;
  NodePath.prototype[typeKey] = function (opts) {
    return t[typeKey](this.node, opts);
  };
};

for (var _i = 0; _i < _arr.length; _i++) {
  _loop();
}

var _loop2 = function (type) {
  if (type[0] === "_") return "continue";
  if (t.TYPES.indexOf(type) < 0) t.TYPES.push(type);

  NodePath.prototype["is" + type] = function (opts) {
    return virtualTypes[type].checkPath(this, opts);
  };
};

for (var type in virtualTypes) {
  var _ret2 = _loop2(type);

  // istanbul ignore next
  if (_ret2 === "continue") continue;
}
module.exports = exports["default"];