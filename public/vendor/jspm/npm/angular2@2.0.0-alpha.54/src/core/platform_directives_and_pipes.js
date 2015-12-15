/* */ 
'use strict';
var di_1 = require('./di');
var lang_1 = require('../facade/lang');
exports.PLATFORM_DIRECTIVES = lang_1.CONST_EXPR(new di_1.OpaqueToken("Platform Directives"));
exports.PLATFORM_PIPES = lang_1.CONST_EXPR(new di_1.OpaqueToken("Platform Pipes"));
