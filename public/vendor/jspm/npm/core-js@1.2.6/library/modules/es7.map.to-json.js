/* */ 
var $export = require('./$.export');
$export($export.P, 'Map', {toJSON: require('./$.collection-to-json')('Map')});
