/* */ 
var sample = require('./sample');
var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
function shuffle(collection) {
  return sample(collection, POSITIVE_INFINITY);
}
module.exports = shuffle;
