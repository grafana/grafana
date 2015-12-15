/* */ 
'use strict';
var strong = require('./$.collection-strong');
require('./$.collection')('Set', function(get) {
  return function Set() {
    return get(this, arguments.length > 0 ? arguments[0] : undefined);
  };
}, {add: function add(value) {
    return strong.def(this, value = value === 0 ? 0 : value, value);
  }}, strong);
