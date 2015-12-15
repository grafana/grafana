/* */ 
(function(process) {
  var restParam = require('../function/restParam'),
      unzip = require('./unzip');
  var zip = restParam(unzip);
  module.exports = zip;
})(require('process'));
