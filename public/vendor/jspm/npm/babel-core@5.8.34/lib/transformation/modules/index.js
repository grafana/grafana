/* */ 
"format cjs";
/**
 * [Please add a description.]
 */

"use strict";

exports.__esModule = true;
exports["default"] = {
  commonStrict: require("./common-strict"),
  amdStrict: require("./amd-strict"),
  umdStrict: require("./umd-strict"),
  common: require("./common"),
  system: require("./system"),
  ignore: require("./ignore"),
  amd: require("./amd"),
  umd: require("./umd")
};
module.exports = exports["default"];