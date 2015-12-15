/* */ 
var $ = require('./$');
if (require('./$.descriptors') && /./g.flags != 'g')
  $.setDesc(RegExp.prototype, 'flags', {
    configurable: true,
    get: require('./$.flags')
  });
