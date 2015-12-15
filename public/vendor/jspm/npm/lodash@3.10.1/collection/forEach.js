/* */ 
var arrayEach = require('../internal/arrayEach'),
    baseEach = require('../internal/baseEach'),
    createForEach = require('../internal/createForEach');
var forEach = createForEach(arrayEach, baseEach);
module.exports = forEach;
