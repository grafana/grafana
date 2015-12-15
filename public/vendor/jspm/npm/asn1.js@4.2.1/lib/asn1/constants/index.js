/* */ 
var constants = exports;
constants._reverse = function reverse(map) {
  var res = {};
  Object.keys(map).forEach(function(key) {
    if ((key | 0) == key)
      key = key | 0;
    var value = map[key];
    res[value] = key;
  });
  return res;
};
constants.der = require('./der');
