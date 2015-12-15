/* */ 
var createDefaults = require('../internal/createDefaults'),
    merge = require('./merge'),
    mergeDefaults = require('../internal/mergeDefaults');
var defaultsDeep = createDefaults(merge, mergeDefaults);
module.exports = defaultsDeep;
