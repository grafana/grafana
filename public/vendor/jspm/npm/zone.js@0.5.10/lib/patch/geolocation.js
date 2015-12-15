/* */ 
'use strict';
var utils = require('../utils');
function apply() {
  if (global.navigator && global.navigator.geolocation) {
    utils.patchPrototype(global.navigator.geolocation, ['getCurrentPosition', 'watchPosition']);
  }
}
module.exports = {apply: apply};
