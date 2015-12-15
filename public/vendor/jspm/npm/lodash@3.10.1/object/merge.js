/* */ 
var baseMerge = require('../internal/baseMerge'),
    createAssigner = require('../internal/createAssigner');
var merge = createAssigner(baseMerge);
module.exports = merge;
