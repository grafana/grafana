/* */ 
var createExtremum = require('../internal/createExtremum'),
    gt = require('../lang/gt');
var NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;
var max = createExtremum(gt, NEGATIVE_INFINITY);
module.exports = max;
