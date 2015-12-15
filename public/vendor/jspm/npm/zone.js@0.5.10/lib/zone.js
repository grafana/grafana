/* */ 
'use strict';
var core = require('./core');
var browserPatch = require('./patch/browser');
global.zone = new core.Zone();
module.exports = {
  Zone: core.Zone,
  zone: global.zone
};
browserPatch.apply();
