exports.translate = function(load) {
  load.metadata.format = 'cjs';
  return 'module.exports = ' + load.source;
};