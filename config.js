/*

The settings before the break are the only ones that are currently implemented
The remaining settings do nothing

elasticsearch:  URL to your elasticsearch server
timeformat:     Format for time in histograms (might go away)
modules:        Panel modules to load. In the future these will be inferred 
                from your initial dashboard, though if you share dashboards you
                will probably need to list them all here 

NOTE: No timezone support yet, everything is in UTC at the moment.

If you need to configure the default dashboard, please see dashboard.js

shared.json contains an example sharable dashboard. Note the subtle differences
between dashboard.js and shared.json. One is a javascript object, the other is
json.

*/
var config = new Settings(
{
    elasticsearch:  'http://localhost:9200',
    timeformat:     'mm/dd HH:MM:ss',
    modules:        ['histogram','map','pie','table','stringquery','sort',
                    'timepicker','text','fields','hits'], 

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
