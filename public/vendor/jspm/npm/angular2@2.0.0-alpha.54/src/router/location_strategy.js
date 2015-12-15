/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var core_1 = require('../../core');
var LocationStrategy = (function() {
  function LocationStrategy() {}
  return LocationStrategy;
})();
exports.LocationStrategy = LocationStrategy;
exports.APP_BASE_HREF = lang_1.CONST_EXPR(new core_1.OpaqueToken('appBaseHref'));
function normalizeQueryParams(params) {
  return (params.length > 0 && params.substring(0, 1) != '?') ? ('?' + params) : params;
}
exports.normalizeQueryParams = normalizeQueryParams;
function joinWithSlash(start, end) {
  if (start.length == 0) {
    return end;
  }
  if (end.length == 0) {
    return start;
  }
  var slashes = 0;
  if (start.endsWith('/')) {
    slashes++;
  }
  if (end.startsWith('/')) {
    slashes++;
  }
  if (slashes == 2) {
    return start + end.substring(1);
  }
  if (slashes == 1) {
    return start + end;
  }
  return start + '/' + end;
}
exports.joinWithSlash = joinWithSlash;
