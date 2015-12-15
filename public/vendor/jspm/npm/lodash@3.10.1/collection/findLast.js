/* */ 
var baseEachRight = require('../internal/baseEachRight'),
    createFind = require('../internal/createFind');
var findLast = createFind(baseEachRight, true);
module.exports = findLast;
