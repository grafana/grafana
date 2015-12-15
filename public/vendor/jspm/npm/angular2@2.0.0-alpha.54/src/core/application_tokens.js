/* */ 
'use strict';
var di_1 = require('./di');
var lang_1 = require('../facade/lang');
exports.APP_COMPONENT_REF_PROMISE = lang_1.CONST_EXPR(new di_1.OpaqueToken('Promise<ComponentRef>'));
exports.APP_COMPONENT = lang_1.CONST_EXPR(new di_1.OpaqueToken('AppComponent'));
exports.APP_ID = lang_1.CONST_EXPR(new di_1.OpaqueToken('AppId'));
function _appIdRandomProviderFactory() {
  return "" + _randomChar() + _randomChar() + _randomChar();
}
exports.APP_ID_RANDOM_PROVIDER = lang_1.CONST_EXPR(new di_1.Provider(exports.APP_ID, {
  useFactory: _appIdRandomProviderFactory,
  deps: []
}));
function _randomChar() {
  return lang_1.StringWrapper.fromCharCode(97 + lang_1.Math.floor(lang_1.Math.random() * 25));
}
exports.PLATFORM_INITIALIZER = lang_1.CONST_EXPR(new di_1.OpaqueToken("Platform Initializer"));
exports.APP_INITIALIZER = lang_1.CONST_EXPR(new di_1.OpaqueToken("Application Initializer"));
exports.PACKAGE_ROOT_URL = lang_1.CONST_EXPR(new di_1.OpaqueToken("Application Packages Root URL"));
