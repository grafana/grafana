/* */ 
var createPartial = require('../internal/createPartial');
var PARTIAL_FLAG = 32;
var partial = createPartial(PARTIAL_FLAG);
partial.placeholder = {};
module.exports = partial;
