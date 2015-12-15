/* */ 
'use strict';
var $export = require('./$.export'),
    $find = require('./$.array-methods')(6),
    KEY = 'findIndex',
    forced = true;
if (KEY in [])
  Array(1)[KEY](function() {
    forced = false;
  });
$export($export.P + $export.F * forced, 'Array', {findIndex: function findIndex(callbackfn) {
    return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }});
require('./$.add-to-unscopables')(KEY);
