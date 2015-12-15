/* */ 
var createCompounder = require('../internal/createCompounder');
var kebabCase = createCompounder(function(result, word, index) {
  return result + (index ? '-' : '') + word.toLowerCase();
});
module.exports = kebabCase;
