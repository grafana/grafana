/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var di_1 = require('./di');
var reflection_1 = require('./reflection/reflection');
var testability_1 = require('./testability/testability');
function _reflector() {
  return reflection_1.reflector;
}
exports.PLATFORM_COMMON_PROVIDERS = lang_1.CONST_EXPR([new di_1.Provider(reflection_1.Reflector, {
  useFactory: _reflector,
  deps: []
}), testability_1.TestabilityRegistry]);
