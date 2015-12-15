/* */ 
var mapDelete = require('./mapDelete'),
    mapGet = require('./mapGet'),
    mapHas = require('./mapHas'),
    mapSet = require('./mapSet');
function MapCache() {
  this.__data__ = {};
}
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;
module.exports = MapCache;
