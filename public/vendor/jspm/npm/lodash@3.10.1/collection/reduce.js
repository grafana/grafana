/* */ 
var arrayReduce = require('../internal/arrayReduce'),
    baseEach = require('../internal/baseEach'),
    createReduce = require('../internal/createReduce');
var reduce = createReduce(arrayReduce, baseEach);
module.exports = reduce;
