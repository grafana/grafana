/* */ 
'use strict';
var $export = require('./$.export');
$export($export.S + $export.F * require('./$.fails')(function() {
  function F() {}
  return !(Array.of.call(F) instanceof F);
}), 'Array', {of: function of() {
    var index = 0,
        $$ = arguments,
        $$len = $$.length,
        result = new (typeof this == 'function' ? this : Array)($$len);
    while ($$len > index)
      result[index] = $$[index++];
    result.length = $$len;
    return result;
  }});
