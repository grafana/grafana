const graphitePlugin = async () =>
  await import(/* webpackChunkName: "graphitePlugin" */ 'app/plugins/datasource/graphite/module');
const cloudwatchPlugin = async () =>
  await import(/* webpackChunkName: "cloudwatchPlugin" */ 'app/plugins/datasource/cloudwatch/module');
const dashboardDSPlugin = async () =>
  await import(/* webpackChunkName "dashboardDSPlugin" */ 'app/plugins/datasource/dashboard/module');
const elasticsearchPlugin = async () =>
  await import(/* webpackChunkName: "elasticsearchPlugin" */ 'app/plugins/datasource/elasticsearch/module');
const opentsdbPlugin = async () =>
  await import(/* webpackChunkName: "opentsdbPlugin" */ 'app/plugins/datasource/opentsdb/module');
const grafanaPlugin = async () =>
  await import(/* webpackChunkName: "grafanaPlugin" */ 'app/plugins/datasource/grafana/module');
const influxdbPlugin = async () =>
  await import(/* webpackChunkName: "influxdbPlugin" */ 'app/plugins/datasource/influxdb/module');
const lokiPlugin = async () => await import(/* webpackChunkName: "lokiPlugin" */ 'app/plugins/datasource/loki/module');
const mixedPlugin = async () =>
  await import(/* webpackChunkName: "mixedPlugin" */ 'app/plugins/datasource/mixed/module');
const mysqlPlugin = async () =>
  await import(/* webpackChunkName: "mysqlPlugin" */ 'app/plugins/datasource/mysql/module');
const postgresPlugin = async () =>
  await import(/* webpackChunkName: "postgresPlugin" */ 'app/plugins/datasource/postgres/module');
const prometheusPlugin = async () =>
  await import(/* webpackChunkName: "prometheusPlugin" */ 'app/plugins/datasource/prometheus/module');
const mssqlPlugin = async () =>
  await import(/* webpackChunkName: "mssqlPlugin" */ 'app/plugins/datasource/mssql/module');
const testDataDSPlugin = async () =>
  await import(/* webpackChunkName: "testDataDSPlugin" */ 'app/plugins/datasource/testdata/module');
const inputDatasourcePlugin = async () =>
  await import(/* webpackChunkName: "inputDatasourcePlugin" */ 'app/plugins/datasource/input/module');
const stackdriverPlugin = async () =>
  await import(/* webpackChunkName: "stackdriverPlugin" */ 'app/plugins/datasource/stackdriver/module');
const azureMonitorPlugin = async () =>
  await import(/* webpackChunkName: "azureMonitorPlugin" */ 'app/plugins/datasource/grafana-azure-monitor-datasource/module');

const textPanel = async () => await import(/* webpackChunkName: "textPanel" */ 'app/plugins/panel/text/module');
const text2Panel = async () => await import(/* webpackChunkName: "text2Panel" */ 'app/plugins/panel/text2/module');
const graph2Panel = async () => await import(/* webpackChunkName: "graph2Panel" */ 'app/plugins/panel/graph2/module');
const graphPanel = async () => await import(/* webpackChunkName: "graphPanel" */ 'app/plugins/panel/graph/module');
const dashListPanel = async () =>
  await import(/* webpackChunkName: "dashListPanel" */ 'app/plugins/panel/dashlist/module');
const pluginsListPanel = async () =>
  await import(/* webpackChunkName: "pluginsListPanel" */ 'app/plugins/panel/pluginlist/module');
const alertListPanel = async () =>
  await import(/* webpackChunkName: "alertListPanel" */ 'app/plugins/panel/alertlist/module');
const annoListPanel = async () =>
  await import(/* webpackChunkName: "annoListPanel" */ 'app/plugins/panel/annolist/module');
const heatmapPanel = async () =>
  await import(/* webpackChunkName: "heatmapPanel" */ 'app/plugins/panel/heatmap/module');
const tablePanel = async () => await import(/* webpackChunkName: "tablePanel" */ 'app/plugins/panel/table/module');
const table2Panel = async () => await import(/* webpackChunkName: "table2Panel" */ 'app/plugins/panel/table2/module');
const singlestatPanel = async () =>
  await import(/* webpackChunkName: "singlestatPanel" */ 'app/plugins/panel/singlestat/module');
const singlestatPanel2 = async () =>
  await import(/* webpackChunkName: "singlestatPanel2" */ 'app/plugins/panel/singlestat2/module');
const gettingStartedPanel = async () =>
  await import(/* webpackChunkName: "gettingStartedPanel" */ 'app/plugins/panel/gettingstarted/module');
const gaugePanel = async () => await import(/* webpackChunkName: "gaugePanel" */ 'app/plugins/panel/gauge/module');
const pieChartPanel = async () =>
  await import(/* webpackChunkName: "pieChartPanel" */ 'app/plugins/panel/piechart/module');
const barGaugePanel = async () =>
  await import(/* webpackChunkName: "barGaugePanel" */ 'app/plugins/panel/bargauge/module');

const exampleApp = async () => await import(/* webpackChunkName: "exampleApp" */ 'app/plugins/app/example-app/module');

const builtInPlugins: any = {
  'app/plugins/datasource/graphite/module': graphitePlugin,
  'app/plugins/datasource/cloudwatch/module': cloudwatchPlugin,
  'app/plugins/datasource/dashboard/module': dashboardDSPlugin,
  'app/plugins/datasource/elasticsearch/module': elasticsearchPlugin,
  'app/plugins/datasource/opentsdb/module': opentsdbPlugin,
  'app/plugins/datasource/grafana/module': grafanaPlugin,
  'app/plugins/datasource/influxdb/module': influxdbPlugin,
  'app/plugins/datasource/loki/module': lokiPlugin,
  'app/plugins/datasource/mixed/module': mixedPlugin,
  'app/plugins/datasource/mysql/module': mysqlPlugin,
  'app/plugins/datasource/postgres/module': postgresPlugin,
  'app/plugins/datasource/mssql/module': mssqlPlugin,
  'app/plugins/datasource/prometheus/module': prometheusPlugin,
  'app/plugins/datasource/testdata/module': testDataDSPlugin,
  'app/plugins/datasource/input/module': inputDatasourcePlugin,
  'app/plugins/datasource/stackdriver/module': stackdriverPlugin,
  'app/plugins/datasource/grafana-azure-monitor-datasource/module': azureMonitorPlugin,

  'app/plugins/panel/text/module': textPanel,
  'app/plugins/panel/text2/module': text2Panel,
  'app/plugins/panel/graph2/module': graph2Panel,
  'app/plugins/panel/graph/module': graphPanel,
  'app/plugins/panel/dashlist/module': dashListPanel,
  'app/plugins/panel/pluginlist/module': pluginsListPanel,
  'app/plugins/panel/alertlist/module': alertListPanel,
  'app/plugins/panel/annolist/module': annoListPanel,
  'app/plugins/panel/heatmap/module': heatmapPanel,
  'app/plugins/panel/table/module': tablePanel,
  'app/plugins/panel/table2/module': table2Panel,
  'app/plugins/panel/singlestat/module': singlestatPanel,
  'app/plugins/panel/singlestat2/module': singlestatPanel2,
  'app/plugins/panel/gettingstarted/module': gettingStartedPanel,
  'app/plugins/panel/gauge/module': gaugePanel,
  'app/plugins/panel/piechart/module': pieChartPanel,
  'app/plugins/panel/bargauge/module': barGaugePanel,
  'app/plugins/panel/logs/module': logsPanel,

  'app/plugins/app/example-app/module': exampleApp,
};

export default builtInPlugins;
