/* */ 
'use strict';
var utils = require('../utils');
function apply() {
  utils.patchClass('FileReader');
}
module.exports = {apply: apply};
