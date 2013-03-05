/*

elasticsearch:  URL to your elasticsearch server
kibana_index:   The default ES index to use for storing Kibana specific object
                such as stored dashboards 
timeformat:     Format for time in histograms (might go away)
modules:        Panel modules to load. In the future these will be inferred 
                from your initial dashboard, though if you share dashboards you
                will probably need to list them all here 

NOTE: No timezone support yet, everything is in UTC at the moment.

If you need to configure the default dashboard, please see dashboard.js

*/
var config = new Settings(
{
    elasticsearch:  'http://localhost:9200',
    kibana_index:   "kibana-int", 
    timeformat:     'mm/dd HH:MM:ss',
    modules:        ['histogram','map','pie','table','stringquery','sort',
                    'timepicker','text','fields','hits','dashcontrol',
                    'column'], 
  }
);
