/* */ 
'use strict';
var exceptions_1 = require('../../facade/exceptions');
var PregenProtoChangeDetector = (function() {
  function PregenProtoChangeDetector() {}
  PregenProtoChangeDetector.isSupported = function() {
    return false;
  };
  PregenProtoChangeDetector.prototype.instantiate = function(dispatcher) {
    throw new exceptions_1.BaseException('Pregen change detection not supported in Js');
  };
  return PregenProtoChangeDetector;
})();
exports.PregenProtoChangeDetector = PregenProtoChangeDetector;
