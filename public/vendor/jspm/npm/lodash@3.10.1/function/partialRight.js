/* */ 
var createPartial = require('../internal/createPartial');
var PARTIAL_RIGHT_FLAG = 64;
var partialRight = createPartial(PARTIAL_RIGHT_FLAG);
partialRight.placeholder = {};
module.exports = partialRight;
