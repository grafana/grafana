import * as graphitePlugin from 'app/plugins/datasource/graphite/module';
import * as cloudwatchPlugin from 'app/plugins/datasource/cloudwatch/module';
import * as elasticsearchPlugin from 'app/plugins/datasource/elasticsearch/module';
import * as opentsdbPlugin from 'app/plugins/datasource/opentsdb/module';
import * as grafanaPlugin from 'app/plugins/datasource/grafana/module';
import * as influxdbPlugin from 'app/plugins/datasource/influxdb/module';
import * as loggingPlugin from 'app/plugins/datasource/logging/module';
import * as mixedPlugin from 'app/plugins/datasource/mixed/module';
import * as mysqlPlugin from 'app/plugins/datasource/mysql/module';
import * as postgresPlugin from 'app/plugins/datasource/postgres/module';
import * as prometheusPlugin from 'app/plugins/datasource/prometheus/module';
import * as mssqlPlugin from 'app/plugins/datasource/mssql/module';
import * as testDataDSPlugin from 'app/plugins/datasource/testdata/module';
import * as stackdriverPlugin from 'app/plugins/datasource/stackdriver/module';

import * as textPanel from 'app/plugins/panel/text/module';
import * as text2Panel from 'app/plugins/panel/text2/module';
import * as graph2Panel from 'app/plugins/panel/graph2/module';
import * as graphPanel from 'app/plugins/panel/graph/module';
import * as dashListPanel from 'app/plugins/panel/dashlist/module';
import * as pluginsListPanel from 'app/plugins/panel/pluginlist/module';
import * as alertListPanel from 'app/plugins/panel/alertlist/module';
import * as heatmapPanel from 'app/plugins/panel/heatmap/module';
import * as tablePanel from 'app/plugins/panel/table/module';
import * as singlestatPanel from 'app/plugins/panel/singlestat/module';
import * as gettingStartedPanel from 'app/plugins/panel/gettingstarted/module';
import * as gaugePanel from 'app/plugins/panel/gauge/module';

const builtInPlugins = {
  'app/plugins/datasource/graphite/module': graphitePlugin,
  'app/plugins/datasource/cloudwatch/module': cloudwatchPlugin,
  'app/plugins/datasource/elasticsearch/module': elasticsearchPlugin,
  'app/plugins/datasource/opentsdb/module': opentsdbPlugin,
  'app/plugins/datasource/grafana/module': grafanaPlugin,
  'app/plugins/datasource/influxdb/module': influxdbPlugin,
  'app/plugins/datasource/logging/module': loggingPlugin,
  'app/plugins/datasource/mixed/module': mixedPlugin,
  'app/plugins/datasource/mysql/module': mysqlPlugin,
  'app/plugins/datasource/postgres/module': postgresPlugin,
  'app/plugins/datasource/mssql/module': mssqlPlugin,
  'app/plugins/datasource/prometheus/module': prometheusPlugin,
  'app/plugins/datasource/testdata/module': testDataDSPlugin,
  'app/plugins/datasource/stackdriver/module': stackdriverPlugin,

  'app/plugins/panel/text/module': textPanel,
  'app/plugins/panel/text2/module': text2Panel,
  'app/plugins/panel/graph2/module': graph2Panel,
  'app/plugins/panel/graph/module': graphPanel,
  'app/plugins/panel/dashlist/module': dashListPanel,
  'app/plugins/panel/pluginlist/module': pluginsListPanel,
  'app/plugins/panel/alertlist/module': alertListPanel,
  'app/plugins/panel/heatmap/module': heatmapPanel,
  'app/plugins/panel/table/module': tablePanel,
  'app/plugins/panel/singlestat/module': singlestatPanel,
  'app/plugins/panel/gettingstarted/module': gettingStartedPanel,
  'app/plugins/panel/gauge/module': gaugePanel,
};

export default builtInPlugins;
