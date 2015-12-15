/* */ 
var global = require('./$.global'),
    $export = require('./$.export'),
    invoke = require('./$.invoke'),
    partial = require('./$.partial'),
    navigator = global.navigator,
    MSIE = !!navigator && /MSIE .\./.test(navigator.userAgent);
var wrap = function(set) {
  return MSIE ? function(fn, time) {
    return set(invoke(partial, [].slice.call(arguments, 2), typeof fn == 'function' ? fn : Function(fn)), time);
  } : set;
};
$export($export.G + $export.B + $export.F * MSIE, {
  setTimeout: wrap(global.setTimeout),
  setInterval: wrap(global.setInterval)
});
