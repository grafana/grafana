"format cjs";
exports.translate = function(load) {
  return 'require("tests/global.js"); exports.extra = "yay!"; \n' + load.source;
}
