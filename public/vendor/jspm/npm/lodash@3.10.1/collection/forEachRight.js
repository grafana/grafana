/* */ 
var arrayEachRight = require('../internal/arrayEachRight'),
    baseEachRight = require('../internal/baseEachRight'),
    createForEach = require('../internal/createForEach');
var forEachRight = createForEach(arrayEachRight, baseEachRight);
module.exports = forEachRight;
