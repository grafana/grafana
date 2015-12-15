/* */ 
var baseToString = require('../internal/baseToString'),
    isIterateeCall = require('../internal/isIterateeCall');
var reWords = (function() {
  var upper = '[A-Z\\xc0-\\xd6\\xd8-\\xde]',
      lower = '[a-z\\xdf-\\xf6\\xf8-\\xff]+';
  return RegExp(upper + '+(?=' + upper + lower + ')|' + upper + '?' + lower + '|' + upper + '+|[0-9]+', 'g');
}());
function words(string, pattern, guard) {
  if (guard && isIterateeCall(string, pattern, guard)) {
    pattern = undefined;
  }
  string = baseToString(string);
  return string.match(pattern || reWords) || [];
}
module.exports = words;
