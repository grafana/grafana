/*

The settings before the break are the only ones that are currently implemented
The remaining settings do nothing

timespan:       Default timespan (eg 1d, 30d, 6h, 20m)
refresh:        Milliseconds between auto refresh.
timeformat:     Format for time in histograms (might go away)
timefield:      Field to use for ISO8601 timestamps (might go away)
indexpattern:   Timestamping pattern for time based indices, 

NOTE: No timezone support yet, everything is in UTC at the moment.

If you need to configure the default dashboard, please see dashboard.js

shared.json contains an example sharable dashboard. Note the subtle differences
between dashboard.js and shared.json. Once is a javascript object, the other is
json.

PLEASE SEE js/

*/
var config = new Settings(
{
    timespan:       '15m',
    refresh:        30000,
    elasticsearch:  'http://localhost:9200',
    timeformat:     'mm/dd HH:MM:ss',
    timefield:      '@timestamp', 
    indexpattern:  '"logstash-"yyyy.mm.dd',
    //indexpattern:   '"shakespeare"', 

    defaultfields:  ['line_text'],
    perpage:        50,
    timezone:       'user',
    operator:       'OR',
    exportdelim:    ',',
    smartindex:     true,
    indexlimit:     150,
    indexdefault:   'logstash-*',
    primaryfield:   '_all'
  }
);