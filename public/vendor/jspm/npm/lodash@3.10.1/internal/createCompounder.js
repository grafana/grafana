/* */ 
var deburr = require('../string/deburr'),
    words = require('../string/words');
function createCompounder(callback) {
  return function(string) {
    var index = -1,
        array = words(deburr(string)),
        length = array.length,
        result = '';
    while (++index < length) {
      result = callback(result, array[index], index);
    }
    return result;
  };
}
module.exports = createCompounder;
