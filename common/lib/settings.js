
// To add a setting, you MUST define a default.
var Settings = function (s) {
  var _d = {
    timespan      : '1h',
    refresh       : 10000,
    elasticsearch : 'localhost:9200',
    perpage       : 50,
    timezone      : 'user',
    timeformat    : 'mm/dd HH:MM:ss',
    timefield     : '@timestamp',
    defaultfields : ['@message'],
    operator      : 'OR',
    exportdelim   : ',',
    smartindex    : true,
    indexpattern  : 'logstash-%Y.%m.%d',
    indexlimit    : 150,
    indexdefault  : 'logstash-*',
    primaryfield  : '_all',
    modules       : []
  }

  // This initializes a new hash on purpose, to avoid adding parameters to 
  // kibanaconfig.js without providing sane defaults
  var _s = {};
  _.each(_d, function(v, k) {
    _s[k] = typeof s[k] !== 'undefined' ? s[k]  : _d[k];
  });

  return _s;

};