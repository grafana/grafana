/* */ 
var createCurry = require('../internal/createCurry');
var CURRY_RIGHT_FLAG = 16;
var curryRight = createCurry(CURRY_RIGHT_FLAG);
curryRight.placeholder = {};
module.exports = curryRight;
