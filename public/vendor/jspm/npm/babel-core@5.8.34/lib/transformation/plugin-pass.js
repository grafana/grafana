/* */ 
"format cjs";


/**
 * This class is responsible for traversing over the provided `File`s
 * AST and running it's parent transformers handlers over it.
 */

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _traversal = require("../traversal");

var _traversal2 = _interopRequireDefault(_traversal);

var PluginPass = (function () {
  function PluginPass(file, plugin) {
    _classCallCheck(this, PluginPass);

    this.plugin = plugin;
    this.file = file;
    this.key = plugin.key;

    if (this.canTransform() && plugin.metadata.experimental && !file.opts.experimental) {
      file.log.warn("THE TRANSFORMER " + this.key + " HAS BEEN MARKED AS EXPERIMENTAL AND IS WIP. USE AT YOUR OWN RISK. " + "THIS WILL HIGHLY LIKELY BREAK YOUR CODE SO USE WITH **EXTREME** CAUTION. ENABLE THE " + "`experimental` OPTION TO IGNORE THIS WARNING.");
    }
  }

  /**
  * [Please add a description.]
  */

  PluginPass.prototype.canTransform = function canTransform() {
    return this.file.transformerDependencies[this.key] || this.file.pipeline.canTransform(this.plugin, this.file.opts);
  };

  /**
   * [Please add a description.]
   */

  PluginPass.prototype.transform = function transform() {
    var file = this.file;
    file.log.debug("Start transformer " + this.key);
    _traversal2["default"](file.ast, this.plugin.visitor, file.scope, file);
    file.log.debug("Finish transformer " + this.key);
  };

  return PluginPass;
})();

exports["default"] = PluginPass;
module.exports = exports["default"];