/* */ 
var createCurry = require('../internal/createCurry');
var CURRY_FLAG = 8;
var curry = createCurry(CURRY_FLAG);
curry.placeholder = {};
module.exports = curry;
