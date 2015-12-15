/* */ 
var baseSortByOrder = require('../internal/baseSortByOrder'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall');
function sortByOrder(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (guard && isIterateeCall(iteratees, orders, guard)) {
    orders = undefined;
  }
  if (!isArray(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  if (!isArray(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseSortByOrder(collection, iteratees, orders);
}
module.exports = sortByOrder;
