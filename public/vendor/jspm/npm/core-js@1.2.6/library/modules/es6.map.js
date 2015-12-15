/* */ 
'use strict';
var strong = require('./$.collection-strong');
require('./$.collection')('Map', function(get) {
  return function Map() {
    return get(this, arguments.length > 0 ? arguments[0] : undefined);
  };
}, {
  get: function get(key) {
    var entry = strong.getEntry(this, key);
    return entry && entry.v;
  },
  set: function set(key, value) {
    return strong.def(this, key === 0 ? 0 : key, value);
  }
}, strong, true);
