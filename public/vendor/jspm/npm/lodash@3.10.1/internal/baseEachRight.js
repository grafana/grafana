/* */ 
var baseForOwnRight = require('./baseForOwnRight'),
    createBaseEach = require('./createBaseEach');
var baseEachRight = createBaseEach(baseForOwnRight, true);
module.exports = baseEachRight;
