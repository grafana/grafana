/* */ 
(function(process) {
  var isObject = require('../lang/isObject');
  function toObject(value) {
    return isObject(value) ? value : Object(value);
  }
  module.exports = toObject;
})(require('process'));
