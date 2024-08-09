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
const prometheusPlugin = async () =>
  await import(/* webpackChunkName: "prometheusPlugin" */ 'app/plugins/datasource/prometheus/module');
const alertmanagerPlugin = async () =>
  await import(/* webpackChunkName: "alertmanagerPlugin" */ 'app/plugins/datasource/alertmanager/module');

import { config } from '@grafana/runtime';
import * as alertListPanel from 'app/plugins/panel/alertlist/module';
import * as annoListPanel from 'app/plugins/panel/annolist/module';
import * as barChartPanel from 'app/plugins/panel/barchart/module';
import * as barGaugePanel from 'app/plugins/panel/bargauge/module';
import * as candlestickPanel from 'app/plugins/panel/candlestick/module';
import * as dashListPanel from 'app/plugins/panel/dashlist/module';
import * as dataGridPanel from 'app/plugins/panel/datagrid/module';
import * as debugPanel from 'app/plugins/panel/debug/module';
import * as flamegraphPanel from 'app/plugins/panel/flamegraph/module';
import * as gaugePanel from 'app/plugins/panel/gauge/module';
import * as gettingStartedPanel from 'app/plugins/panel/gettingstarted/module';
import * as histogramPanel from 'app/plugins/panel/histogram/module';
import * as livePanel from 'app/plugins/panel/live/module';
import * as logsPanel from 'app/plugins/panel/logs/module';
import * as newsPanel from 'app/plugins/panel/news/module';
import * as pieChartPanel from 'app/plugins/panel/piechart/module';
import * as statPanel from 'app/plugins/panel/stat/module';
import * as stateTimelinePanel from 'app/plugins/panel/state-timeline/module';
import * as statusHistoryPanel from 'app/plugins/panel/status-history/module';
import * as tablePanel from 'app/plugins/panel/table/module';
import * as textPanel from 'app/plugins/panel/text/module';
import * as timeseriesPanel from 'app/plugins/panel/timeseries/module';
import * as tracesPanel from 'app/plugins/panel/traces/module';
import * as trendPanel from 'app/plugins/panel/trend/module';
import * as welcomeBanner from 'app/plugins/panel/welcome/module';

// Async loaded panels
const geomapPanel = async () => await import(/* webpackChunkName: "geomapPanel" */ 'app/plugins/panel/geomap/module');
const canvasPanel = async () => await import(/* webpackChunkName: "canvasPanel" */ 'app/plugins/panel/canvas/module');
const graphPanel = async () => await import(/* webpackChunkName: "graphPlugin" */ 'app/plugins/panel/graph/module');
const xychartPanel = async () => {
  if (config.featureToggles.autoMigrateXYChartPanel) {
    return await import(/* webpackChunkName: "xychart2" */ 'app/plugins/panel/xychart/v2/module');
  } else {
    return await import(/* webpackChunkName: "xychart" */ 'app/plugins/panel/xychart/module');
  }
};
const heatmapPanel = async () =>
  await import(/* webpackChunkName: "heatmapPanel" */ 'app/plugins/panel/heatmap/module');
const tableOldPanel = async () =>
  await import(/* webpackChunkName: "tableOldPlugin" */ 'app/plugins/panel/table-old/module');

const nodeGraph = async () =>
  await import(/* webpackChunkName: "nodeGraphPanel" */ 'app/plugins/panel/nodeGraph/module');

const builtInPlugins: Record<string, System.Module | (() => Promise<System.Module>)> = {
  // datasources
  'core:plugin/graphite': graphitePlugin,
  'core:plugin/cloudwatch': cloudwatchPlugin,
  'core:plugin/dashboard': dashboardDSPlugin,
  'core:plugin/elasticsearch': elasticsearchPlugin,
  'core:plugin/opentsdb': opentsdbPlugin,
  'core:plugin/grafana': grafanaPlugin,
  'core:plugin/influxdb': influxdbPlugin,
  'core:plugin/loki': lokiPlugin,
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
  'core:plugin/graph': graphPanel,
  'core:plugin/xychart': xychartPanel,
  'core:plugin/geomap': geomapPanel,
  'core:plugin/canvas': canvasPanel,
  'core:plugin/dashlist': dashListPanel,
  'core:plugin/alertlist': alertListPanel,
  'core:plugin/annolist': annoListPanel,
  'core:plugin/heatmap': heatmapPanel,
  'core:plugin/table': tablePanel,
  'core:plugin/table-old': tableOldPanel,
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
  'core:plugin/traces': tracesPanel,
  'core:plugin/welcome': welcomeBanner,
  'core:plugin/nodeGraph': nodeGraph,
  'core:plugin/histogram': histogramPanel,
};

export default builtInPlugins;
