/* */ 
var createCompounder = require('../internal/createCompounder');
var startCase = createCompounder(function(result, word, index) {
  return result + (index ? ' ' : '') + (word.charAt(0).toUpperCase() + word.slice(1));
});
module.exports = startCase;
