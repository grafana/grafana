
// To add a setting, you MUST define a default.
// THESE ARE ONLY DEFAULTS. They are overridden by config.js in the root directory
var Settings = function (s) {
  var _d = {
    elasticsearch : "http://"+window.location.hostname+":9200",
    modules       : [],
    kibana_index  : 'kibana-int'
  }

  // This initializes a new hash on purpose, to avoid adding parameters to 
  // config.js without providing sane defaults
  var _s = {};
  _.each(_d, function(v, k) {
    _s[k] = typeof s[k] !== 'undefined' ? s[k]  : _d[k];
  });

  return _s;

};
