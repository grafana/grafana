/* */ 
var $export = require('./$.export');
$export($export.P, 'Set', {toJSON: require('./$.collection-to-json')('Set')});
