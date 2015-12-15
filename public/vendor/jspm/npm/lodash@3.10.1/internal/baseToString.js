/* */ 
(function(process) {
  function baseToString(value) {
    return value == null ? '' : (value + '');
  }
  module.exports = baseToString;
})(require('process'));
