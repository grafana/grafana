/* */ 
var baseSetData = require('./baseSetData'),
    now = require('../date/now');
var HOT_COUNT = 150,
    HOT_SPAN = 16;
var setData = (function() {
  var count = 0,
      lastCalled = 0;
  return function(key, value) {
    var stamp = now(),
        remaining = HOT_SPAN - (stamp - lastCalled);
    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return key;
      }
    } else {
      count = 0;
    }
    return baseSetData(key, value);
  };
}());
module.exports = setData;
