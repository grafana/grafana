/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _path = require("./path");

var _path2 = _interopRequireDefault(_path);

var _types = require("../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var TraversalContext = (function () {
  function TraversalContext(scope, opts, state, parentPath) {
    _classCallCheck(this, TraversalContext);

    this.queue = null;

    this.parentPath = parentPath;
    this.scope = scope;
    this.state = state;
    this.opts = opts;
  }

  /**
   * [Please add a description.]
   */

  TraversalContext.prototype.shouldVisit = function shouldVisit(node) {
    var opts = this.opts;
    if (opts.enter || opts.exit) return true;

    if (opts[node.type]) return true;

    var keys = t.VISITOR_KEYS[node.type];
    if (!keys || !keys.length) return false;

    var _arr = keys;
    for (var _i = 0; _i < _arr.length; _i++) {
      var key = _arr[_i];
      if (node[key]) return true;
    }

    return false;
  };

  /**
   * [Please add a description.]
   */

  TraversalContext.prototype.create = function create(node, obj, key, listKey) {
    var path = _path2["default"].get({
      parentPath: this.parentPath,
      parent: node,
      container: obj,
      key: key,
      listKey: listKey
    });
    path.unshiftContext(this);
    return path;
  };

  /**
   * [Please add a description.]
   */

  TraversalContext.prototype.visitMultiple = function visitMultiple(container, parent, listKey) {
    // nothing to traverse!
    if (container.length === 0) return false;

    var visited = [];

    var queue = this.queue = [];
    var stop = false;

    // build up initial queue
    for (var key = 0; key < container.length; key++) {
      var self = container[key];
      if (self && this.shouldVisit(self)) {
        queue.push(this.create(parent, container, key, listKey));
      }
    }

    // visit the queue
    var _arr2 = queue;
    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var path = _arr2[_i2];
      path.resync();

      if (visited.indexOf(path.node) >= 0) continue;
      visited.push(path.node);

      if (path.visit()) {
        stop = true;
        break;
      }
    }

    var _arr3 = queue;
    for (var _i3 = 0; _i3 < _arr3.length; _i3++) {
      var path = _arr3[_i3];
      path.shiftContext();
    }

    this.queue = null;

    return stop;
  };

  /**
   * [Please add a description.]
   */

  TraversalContext.prototype.visitSingle = function visitSingle(node, key) {
    if (this.shouldVisit(node[key])) {
      var path = this.create(node, node, key);
      path.visit();
      path.shiftContext();
    }
  };

  /**
   * [Please add a description.]
   */

  TraversalContext.prototype.visit = function visit(node, key) {
    var nodes = node[key];
    if (!nodes) return;

    if (Array.isArray(nodes)) {
      return this.visitMultiple(nodes, node, key);
    } else {
      return this.visitSingle(node, key);
    }
  };

  return TraversalContext;
})();

exports["default"] = TraversalContext;
module.exports = exports["default"];