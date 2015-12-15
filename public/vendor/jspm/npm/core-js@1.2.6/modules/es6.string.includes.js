/* */ 
'use strict';
var $export = require('./$.export'),
    context = require('./$.string-context'),
    INCLUDES = 'includes';
$export($export.P + $export.F * require('./$.fails-is-regexp')(INCLUDES), 'String', {includes: function includes(searchString) {
    return !!~context(this, searchString, INCLUDES).indexOf(searchString, arguments.length > 1 ? arguments[1] : undefined);
  }});
