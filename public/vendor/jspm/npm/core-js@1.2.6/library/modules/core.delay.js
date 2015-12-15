/* */ 
var global = require('./$.global'),
    core = require('./$.core'),
    $export = require('./$.export'),
    partial = require('./$.partial');
$export($export.G + $export.F, {delay: function delay(time) {
    return new (core.Promise || global.Promise)(function(resolve) {
      setTimeout(partial.call(resolve, true), time);
    });
  }});
