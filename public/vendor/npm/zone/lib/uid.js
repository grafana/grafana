module.exports = uid;

var uidCounter = 0;
function uid() { return ++uidCounter; }
