/* */ 
var $export = require('./$.export'),
    toIObject = require('./$.to-iobject'),
    toLength = require('./$.to-length');
$export($export.S, 'String', {raw: function raw(callSite) {
    var tpl = toIObject(callSite.raw),
        len = toLength(tpl.length),
        $$ = arguments,
        $$len = $$.length,
        res = [],
        i = 0;
    while (len > i) {
      res.push(String(tpl[i++]));
      if (i < $$len)
        res.push(String($$[i]));
    }
    return res.join('');
  }});
