/* */ 
var createCompounder = require('../internal/createCompounder');
var snakeCase = createCompounder(function(result, word, index) {
  return result + (index ? '_' : '') + word.toLowerCase();
});
module.exports = snakeCase;
