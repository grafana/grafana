/* */ 
var core = require('../../modules/$.core');
module.exports = function stringify(it) {
  return (core.JSON && core.JSON.stringify || JSON.stringify).apply(JSON, arguments);
};
