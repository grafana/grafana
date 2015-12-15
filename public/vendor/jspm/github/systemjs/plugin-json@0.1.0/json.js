/*
  JSON plugin
*/
exports.translate = function(load) {
  return 'module.exports = ' + load.source;
}