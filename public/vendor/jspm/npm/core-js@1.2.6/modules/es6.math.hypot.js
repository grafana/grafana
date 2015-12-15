/* */ 
var $export = require('./$.export'),
    abs = Math.abs;
$export($export.S, 'Math', {hypot: function hypot(value1, value2) {
    var sum = 0,
        i = 0,
        $$ = arguments,
        $$len = $$.length,
        larg = 0,
        arg,
        div;
    while (i < $$len) {
      arg = abs($$[i++]);
      if (larg < arg) {
        div = larg / arg;
        sum = sum * div * div + 1;
        larg = arg;
      } else if (arg > 0) {
        div = arg / larg;
        sum += div * div;
      } else
        sum += arg;
    }
    return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
  }});
