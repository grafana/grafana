/* */ 
var arrayReduceRight = require('../internal/arrayReduceRight'),
    baseEachRight = require('../internal/baseEachRight'),
    createReduce = require('../internal/createReduce');
var reduceRight = createReduce(arrayReduceRight, baseEachRight);
module.exports = reduceRight;
