module.exports = function(name, address, fetch, callback, errback) {
  fetch(address, function(source) {
    callback('exports.plugin = true; ' + source);
  });
}
