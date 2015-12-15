/* */ 
var path = require('./$.path'),
    $export = require('./$.export');
require('./$.core')._ = path._ = path._ || {};
$export($export.P + $export.F, 'Function', {part: require('./$.partial')});
