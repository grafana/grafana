/* */ 
var ITERATOR = require('./$.wks')('iterator'),
    SAFE_CLOSING = false;
try {
  var riter = [7][ITERATOR]();
  riter['return'] = function() {
    SAFE_CLOSING = true;
  };
  Array.from(riter, function() {
    throw 2;
  });
} catch (e) {}
module.exports = function(exec, skipClosing) {
  if (!skipClosing && !SAFE_CLOSING)
    return false;
  var safe = false;
  try {
    var arr = [7],
        iter = arr[ITERATOR]();
    iter.next = function() {
      safe = true;
    };
    arr[ITERATOR] = function() {
      return iter;
    };
    exec(arr);
  } catch (e) {}
  return safe;
};
