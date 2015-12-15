/* */ 
var assign = require('./assign'),
    assignDefaults = require('../internal/assignDefaults'),
    createDefaults = require('../internal/createDefaults');
var defaults = createDefaults(assign, assignDefaults);
module.exports = defaults;
