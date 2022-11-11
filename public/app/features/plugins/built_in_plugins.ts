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
const jaegerPlugin = async () =>
  await import(/* webpackChunkName: "jaegerPlugin" */ 'app/plugins/datasource/jaeger/module');
const zipkinPlugin = async () =>
  await import(/* webpackChunkName: "zipkinPlugin" */ 'app/plugins/datasource/zipkin/module');
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
const cloudMonitoringPlugin = async () =>
  await import(/* webpackChunkName: "cloudMonitoringPlugin" */ 'app/plugins/datasource/cloud-monitoring/module');
const azureMonitorPlugin = async () =>
  await import(
    /* webpackChunkName: "azureMonitorPlugin" */ 'app/plugins/datasource/grafana-azure-monitor-datasource/module'
  );
const tempoPlugin = async () =>
  await import(/* webpackChunkName: "tempoPlugin" */ 'app/plugins/datasource/tempo/module');
const alertmanagerPlugin = async () =>
  await import(/* webpackChunkName: "alertmanagerPlugin" */ 'app/plugins/datasource/alertmanager/module');
const phlarePlugin = async () =>
  await import(/* webpackChunkName: "phlarePlugin" */ 'app/plugins/datasource/phlare/module');
const parcaPlugin = async () =>
  await import(/* webpackChunkName: "parcaPlugin" */ 'app/plugins/datasource/parca/module');

import { config } from '@grafana/runtime';
import * as alertGroupsPanel from 'app/plugins/panel/alertGroups/module';
import * as alertListPanel from 'app/plugins/panel/alertlist/module';
import * as annoListPanel from 'app/plugins/panel/annolist/module';
import * as barChartPanel from 'app/plugins/panel/barchart/module';
import * as barGaugePanel from 'app/plugins/panel/bargauge/module';
import * as candlestickPanel from 'app/plugins/panel/candlestick/module';
import * as dashListPanel from 'app/plugins/panel/dashlist/module';
import * as debugPanel from 'app/plugins/panel/debug/module';
import * as flamegraphPanel from 'app/plugins/panel/flamegraph/module';
import * as gaugePanel from 'app/plugins/panel/gauge/module';
import * as gettingStartedPanel from 'app/plugins/panel/gettingstarted/module';
import * as histogramPanel from 'app/plugins/panel/histogram/module';
import * as livePanel from 'app/plugins/panel/live/module';
import * as logsPanel from 'app/plugins/panel/logs/module';
import * as newsPanel from 'app/plugins/panel/news/module';
import * as nodeGraph from 'app/plugins/panel/nodeGraph/module';
import * as pieChartPanel from 'app/plugins/panel/piechart/module';
import * as statPanel from 'app/plugins/panel/stat/module';
import * as stateTimelinePanel from 'app/plugins/panel/state-timeline/module';
import * as statusHistoryPanel from 'app/plugins/panel/status-history/module';
import * as tablePanel from 'app/plugins/panel/table/module';
import * as textPanel from 'app/plugins/panel/text/module';
import * as timeseriesPanel from 'app/plugins/panel/timeseries/module';
import * as tracesPanel from 'app/plugins/panel/traces/module';
import * as welcomeBanner from 'app/plugins/panel/welcome/module';
import * as xyChartPanel from 'app/plugins/panel/xychart/module';

// Async loaded panels
const geomapPanel = async () => await import(/* webpackChunkName: "geomapPanel" */ 'app/plugins/panel/geomap/module');
const canvasPanel = async () => await import(/* webpackChunkName: "canvasPanel" */ 'app/plugins/panel/canvas/module');
const iconPanel = async () => await import(/* webpackChunkName: "iconPanel" */ 'app/plugins/panel/icon/module');
const graphPanel = async () => await import(/* webpackChunkName: "graphPlugin" */ 'app/plugins/panel/graph/module');
const heatmapPanel = async () =>
  await import(/* webpackChunkName: "heatmapPanel" */ 'app/plugins/panel/heatmap/module');
const heatmapPanelOLD = async () =>
  await import(/* webpackChunkName: "heatmapPanelOLD" */ 'app/plugins/panel/heatmap-old/module');

const tableOldPanel = async () =>
  await import(/* webpackChunkName: "tableOldPlugin" */ 'app/plugins/panel/table-old/module');

// Automatically migrate heatmap panel.
if (config.featureToggles.useLegacyHeatmapPanel) {
  const heatmap = config.panels['heatmap'];
  const legacy = config.panels['heatmap-old'];
  legacy.id = heatmap.id;
  legacy.module = heatmap.module;
  legacy.state = heatmap.state;
  config.panels['heatmap'] = legacy;
}
delete config.panels['heatmap-old'];

const builtInPlugins: any = {
  'app/plugins/datasource/graphite/module': graphitePlugin,
  'app/plugins/datasource/cloudwatch/module': cloudwatchPlugin,
  'app/plugins/datasource/dashboard/module': dashboardDSPlugin,
  'app/plugins/datasource/elasticsearch/module': elasticsearchPlugin,
  'app/plugins/datasource/opentsdb/module': opentsdbPlugin,
  'app/plugins/datasource/grafana/module': grafanaPlugin,
  'app/plugins/datasource/influxdb/module': influxdbPlugin,
  'app/plugins/datasource/loki/module': lokiPlugin,
  'app/plugins/datasource/jaeger/module': jaegerPlugin,
  'app/plugins/datasource/zipkin/module': zipkinPlugin,
  'app/plugins/datasource/mixed/module': mixedPlugin,
  'app/plugins/datasource/mysql/module': mysqlPlugin,
  'app/plugins/datasource/postgres/module': postgresPlugin,
  'app/plugins/datasource/mssql/module': mssqlPlugin,
  'app/plugins/datasource/prometheus/module': prometheusPlugin,
  'app/plugins/datasource/testdata/module': testDataDSPlugin,
  'app/plugins/datasource/cloud-monitoring/module': cloudMonitoringPlugin,
  'app/plugins/datasource/grafana-azure-monitor-datasource/module': azureMonitorPlugin,
  'app/plugins/datasource/tempo/module': tempoPlugin,
  'app/plugins/datasource/alertmanager/module': alertmanagerPlugin,
  'app/plugins/datasource/phlare/module': phlarePlugin,
  'app/plugins/datasource/parca/module': parcaPlugin,

  'app/plugins/panel/text/module': textPanel,
  'app/plugins/panel/timeseries/module': timeseriesPanel,
  'app/plugins/panel/state-timeline/module': stateTimelinePanel,
  'app/plugins/panel/status-history/module': statusHistoryPanel,
  'app/plugins/panel/candlestick/module': candlestickPanel,
  'app/plugins/panel/graph/module': graphPanel,
  'app/plugins/panel/xychart/module': xyChartPanel,
  'app/plugins/panel/geomap/module': geomapPanel,
  'app/plugins/panel/canvas/module': canvasPanel,
  'app/plugins/panel/icon/module': iconPanel,
  'app/plugins/panel/dashlist/module': dashListPanel,
  'app/plugins/panel/alertlist/module': alertListPanel,
  'app/plugins/panel/annolist/module': annoListPanel,
  'app/plugins/panel/heatmap/module': config.featureToggles.useLegacyHeatmapPanel ? heatmapPanelOLD : heatmapPanel,
  'app/plugins/panel/table/module': tablePanel,
  'app/plugins/panel/table-old/module': tableOldPanel,
  'app/plugins/panel/news/module': newsPanel,
  'app/plugins/panel/live/module': livePanel,
  'app/plugins/panel/stat/module': statPanel,
  'app/plugins/panel/debug/module': debugPanel,
  'app/plugins/panel/flamegraph/module': flamegraphPanel,
  'app/plugins/panel/gettingstarted/module': gettingStartedPanel,
  'app/plugins/panel/gauge/module': gaugePanel,
  'app/plugins/panel/piechart/module': pieChartPanel,
  'app/plugins/panel/bargauge/module': barGaugePanel,
  'app/plugins/panel/barchart/module': barChartPanel,
  'app/plugins/panel/logs/module': logsPanel,
  'app/plugins/panel/traces/module': tracesPanel,
  'app/plugins/panel/welcome/module': welcomeBanner,
  'app/plugins/panel/nodeGraph/module': nodeGraph,
  'app/plugins/panel/histogram/module': histogramPanel,
  'app/plugins/panel/alertGroups/module': alertGroupsPanel,
};

export default builtInPlugins;
