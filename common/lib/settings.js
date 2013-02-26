
// To add a setting, you MUST define a default.
var Settings = function (s) {
  var _d = {
    elasticsearch : 'localhost:9200',
    timeformat    : 'mm/dd HH:MM:ss',
    modules       : [],
  }

  // This initializes a new hash on purpose, to avoid adding parameters to 
  // kibanaconfig.js without providing sane defaults
  var _s = {};
  _.each(_d, function(v, k) {
    _s[k] = typeof s[k] !== 'undefined' ? s[k]  : _d[k];
  });

  return _s;

};
