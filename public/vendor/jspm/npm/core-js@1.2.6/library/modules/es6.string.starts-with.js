/* */ 
'use strict';
var $export = require('./$.export'),
    toLength = require('./$.to-length'),
    context = require('./$.string-context'),
    STARTS_WITH = 'startsWith',
    $startsWith = ''[STARTS_WITH];
$export($export.P + $export.F * require('./$.fails-is-regexp')(STARTS_WITH), 'String', {startsWith: function startsWith(searchString) {
    var that = context(this, searchString, STARTS_WITH),
        $$ = arguments,
        index = toLength(Math.min($$.length > 1 ? $$[1] : undefined, that.length)),
        search = String(searchString);
    return $startsWith ? $startsWith.call(that, search, index) : that.slice(index, index + search.length) === search;
  }});
