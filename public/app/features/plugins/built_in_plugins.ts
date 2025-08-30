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
const mixedPlugin = async () =>
  await import(/* webpackChunkName: "mixedPlugin" */ 'app/plugins/datasource/mixed/module');
const prometheusPlugin = async () =>
  await import(/* webpackChunkName: "prometheusPlugin" */ 'app/plugins/datasource/prometheus/module');
const alertmanagerPlugin = async () =>
  await import(/* webpackChunkName: "alertmanagerPlugin" */ 'app/plugins/datasource/alertmanager/module');

// Async loaded panels
const alertListPanel = async () =>
  await import(/* webpackChunkName: "alertListPanel" */ 'app/plugins/panel/alertlist/module');
const annoListPanel = async () =>
  await import(/* webpackChunkName: "annoListPanel" */ 'app/plugins/panel/annolist/module');
const barChartPanel = async () =>
  await import(/* webpackChunkName: "barChartPanel" */ 'app/plugins/panel/barchart/module');
const barGaugePanel = async () =>
  await import(/* webpackChunkName: "barGaugePanel" */ 'app/plugins/panel/bargauge/module');
const candlestickPanel = async () =>
  await import(/* webpackChunkName: "candlestickPanel" */ 'app/plugins/panel/candlestick/module');
const dashListPanel = async () =>
  await import(/* webpackChunkName: "dashListPanel" */ 'app/plugins/panel/dashlist/module');
const dataGridPanel = async () =>
  await import(/* webpackChunkName: "dataGridPanel" */ 'app/plugins/panel/datagrid/module');
const debugPanel = async () => await import(/* webpackChunkName: "debugPanel" */ 'app/plugins/panel/debug/module');
const flamegraphPanel = async () =>
  await import(/* webpackChunkName: "flamegraphPanel" */ 'app/plugins/panel/flamegraph/module');
const gaugePanel = async () => await import(/* webpackChunkName: "gaugePanel" */ 'app/plugins/panel/gauge/module');
const gettingStartedPanel = async () =>
  await import(/* webpackChunkName: "gettingStartedPanel" */ 'app/plugins/panel/gettingstarted/module');
const histogramPanel = async () =>
  await import(/* webpackChunkName: "histogramPanel" */ 'app/plugins/panel/histogram/module');
const livePanel = async () => await import(/* webpackChunkName: "livePanel" */ 'app/plugins/panel/live/module');
const logsPanel = async () => await import(/* webpackChunkName: "logsPanel" */ 'app/plugins/panel/logs/module');
const newLogsPanel = async () =>
  await import(/* webpackChunkName: "newLogsPanel" */ 'app/plugins/panel/logs-new/module');
const newsPanel = async () => await import(/* webpackChunkName: "newsPanel" */ 'app/plugins/panel/news/module');
const pieChartPanel = async () =>
  await import(/* webpackChunkName: "pieChartPanel" */ 'app/plugins/panel/piechart/module');
const statPanel = async () => await import(/* webpackChunkName: "statPanel" */ 'app/plugins/panel/stat/module');
const stateTimelinePanel = async () =>
  await import(/* webpackChunkName: "stateTimelinePanel" */ 'app/plugins/panel/state-timeline/module');
const statusHistoryPanel = async () =>
  await import(/* webpackChunkName: "statusHistoryPanel" */ 'app/plugins/panel/status-history/module');
const tablePanel = async () => await import(/* webpackChunkName: "tablePanel" */ 'app/plugins/panel/table/module');
const textPanel = async () => await import(/* webpackChunkName: "textPanel" */ 'app/plugins/panel/text/module');
const timeseriesPanel = async () =>
  await import(/* webpackChunkName: "timeseriesPanel" */ 'app/plugins/panel/timeseries/module');
const tracesPanel = async () => await import(/* webpackChunkName: "tracesPanel" */ 'app/plugins/panel/traces/module');
const trendPanel = async () => await import(/* webpackChunkName: "trendPanel" */ 'app/plugins/panel/trend/module');
const welcomeBanner = async () =>
  await import(/* webpackChunkName: "welcomeBanner" */ 'app/plugins/panel/welcome/module');

const geomapPanel = async () => await import(/* webpackChunkName: "geomapPanel" */ 'app/plugins/panel/geomap/module');
const canvasPanel = async () => await import(/* webpackChunkName: "canvasPanel" */ 'app/plugins/panel/canvas/module');
const xychartPanel = async () => await import(/* webpackChunkName: "xychart" */ 'app/plugins/panel/xychart/module');
const heatmapPanel = async () =>
  await import(/* webpackChunkName: "heatmapPanel" */ 'app/plugins/panel/heatmap/module');

const nodeGraph = async () =>
  await import(/* webpackChunkName: "nodeGraphPanel" */ 'app/plugins/panel/nodeGraph/module');

const builtInPlugins: Record<string, System.Module | (() => Promise<System.Module>)> = {
  // datasources
  'core:plugin/cloudwatch': cloudwatchPlugin,
  'core:plugin/dashboard': dashboardDSPlugin,
  'core:plugin/elasticsearch': elasticsearchPlugin,
  'core:plugin/opentsdb': opentsdbPlugin,
  'core:plugin/grafana': grafanaPlugin,
  'core:plugin/influxdb': influxdbPlugin,
  'core:plugin/mixed': mixedPlugin,
  'core:plugin/prometheus': prometheusPlugin,
  'core:plugin/alertmanager': alertmanagerPlugin,
  // panels
  'core:plugin/text': textPanel,
  'core:plugin/timeseries': timeseriesPanel,
  'core:plugin/trend': trendPanel,
  'core:plugin/state-timeline': stateTimelinePanel,
  'core:plugin/status-history': statusHistoryPanel,
  'core:plugin/candlestick': candlestickPanel,
  'core:plugin/xychart': xychartPanel,
  'core:plugin/geomap': geomapPanel,
  'core:plugin/canvas': canvasPanel,
  'core:plugin/dashlist': dashListPanel,
  'core:plugin/alertlist': alertListPanel,
  'core:plugin/annolist': annoListPanel,
  'core:plugin/heatmap': heatmapPanel,
  'core:plugin/table': tablePanel,
  'core:plugin/news': newsPanel,
  'core:plugin/live': livePanel,
  'core:plugin/stat': statPanel,
  'core:plugin/datagrid': dataGridPanel,
  'core:plugin/debug': debugPanel,
  'core:plugin/flamegraph': flamegraphPanel,
  'core:plugin/gettingstarted': gettingStartedPanel,
  'core:plugin/gauge': gaugePanel,
  'core:plugin/piechart': pieChartPanel,
  'core:plugin/bargauge': barGaugePanel,
  'core:plugin/barchart': barChartPanel,
  'core:plugin/logs': logsPanel,
  'core:plugin/logs-new': newLogsPanel,
  'core:plugin/traces': tracesPanel,
  'core:plugin/welcome': welcomeBanner,
  'core:plugin/nodeGraph': nodeGraph,
  'core:plugin/histogram': histogramPanel,
};

export default builtInPlugins;
