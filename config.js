/*

elasticsearch:  URL to your elasticsearch server. You almost certainly don't
                want 'http://localhost:9200' here. Even if Kibana and ES are on
                the same host
kibana_index:   The default ES index to use for storing Kibana specific object
                such as stored dashboards
modules:        Panel modules to load. In the future these will be inferred
                from your initial dashboard, though if you share dashboards you
                will probably need to list them all here

If you need to configure the default dashboard, please see dashboards/default

*/
var config = new Settings(
{
  // By default this will attempt to reach ES at the same host you have
  // elasticsearch installed on. You probably want to set it to the FQDN of your
  // elasticsearch host
  elasticsearch:    "http://"+window.location.hostname+":9200",
  // elasticsearch: 'http://localhost:9200',
  kibana_index:     "kibana-int",
  modules:          ['histogram','map','pie','table','filtering',
                    'timepicker','text','fields','hits','dashcontrol',
                    'column','derivequeries','trends','bettermap','query',
                    'terms'],
  }
);
