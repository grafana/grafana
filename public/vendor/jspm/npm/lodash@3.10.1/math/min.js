/* */ 
var createExtremum = require('../internal/createExtremum'),
    lt = require('../lang/lt');
var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;
var min = createExtremum(lt, POSITIVE_INFINITY);
module.exports = min;
