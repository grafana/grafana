/* */ 
var distinctUntilChanged_1 = require('./distinctUntilChanged');
function distinctUntilKeyChanged(key, compare) {
  return distinctUntilChanged_1.distinctUntilChanged.call(this, function(x, y) {
    if (compare) {
      return compare(x[key], y[key]);
    }
    return x[key] === y[key];
  });
}
exports.distinctUntilKeyChanged = distinctUntilKeyChanged;
