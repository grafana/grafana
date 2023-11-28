import { __awaiter } from "tslib";
const graphitePlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "graphitePlugin" */ 'app/plugins/datasource/graphite/module'); });
const cloudwatchPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "cloudwatchPlugin" */ 'app/plugins/datasource/cloudwatch/module'); });
const dashboardDSPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName "dashboardDSPlugin" */ 'app/plugins/datasource/dashboard/module'); });
const elasticsearchPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "elasticsearchPlugin" */ 'app/plugins/datasource/elasticsearch/module'); });
const opentsdbPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "opentsdbPlugin" */ 'app/plugins/datasource/opentsdb/module'); });
const grafanaPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "grafanaPlugin" */ 'app/plugins/datasource/grafana/module'); });
const influxdbPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "influxdbPlugin" */ 'app/plugins/datasource/influxdb/module'); });
const lokiPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "lokiPlugin" */ 'app/plugins/datasource/loki/module'); });
const jaegerPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "jaegerPlugin" */ 'app/plugins/datasource/jaeger/module'); });
const zipkinPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "zipkinPlugin" */ 'app/plugins/datasource/zipkin/module'); });
const mixedPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "mixedPlugin" */ 'app/plugins/datasource/mixed/module'); });
const mysqlPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "mysqlPlugin" */ 'app/plugins/datasource/mysql/module'); });
const postgresPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "postgresPlugin" */ 'app/plugins/datasource/postgres/module'); });
const prometheusPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "prometheusPlugin" */ 'app/plugins/datasource/prometheus/module'); });
const mssqlPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "mssqlPlugin" */ 'app/plugins/datasource/mssql/module'); });
const testDataDSPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "testDataDSPlugin" */ '@grafana-plugins/grafana-testdata-datasource/module'); });
const cloudMonitoringPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "cloudMonitoringPlugin" */ 'app/plugins/datasource/cloud-monitoring/module'); });
const azureMonitorPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "azureMonitorPlugin" */ 'app/plugins/datasource/azuremonitor/module'); });
const tempoPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "tempoPlugin" */ 'app/plugins/datasource/tempo/module'); });
const alertmanagerPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "alertmanagerPlugin" */ 'app/plugins/datasource/alertmanager/module'); });
const pyroscopePlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "pyroscopePlugin" */ 'app/plugins/datasource/grafana-pyroscope-datasource/module'); });
const parcaPlugin = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "parcaPlugin" */ 'app/plugins/datasource/parca/module'); });
import * as alertGroupsPanel from 'app/plugins/panel/alertGroups/module';
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
import * as nodeGraph from 'app/plugins/panel/nodeGraph/module';
import * as pieChartPanel from 'app/plugins/panel/piechart/module';
// @PERCONA
import * as pmmCheckPanel from 'app/plugins/panel/pmm-check/module';
import * as pmmUpdatePanel from 'app/plugins/panel/pmm-update/module';
import * as statPanel from 'app/plugins/panel/stat/module';
import * as stateTimelinePanel from 'app/plugins/panel/state-timeline/module';
import * as statusHistoryPanel from 'app/plugins/panel/status-history/module';
import * as tablePanel from 'app/plugins/panel/table/module';
import * as textPanel from 'app/plugins/panel/text/module';
import * as timeseriesPanel from 'app/plugins/panel/timeseries/module';
import * as tracesPanel from 'app/plugins/panel/traces/module';
import * as trendPanel from 'app/plugins/panel/trend/module';
import * as welcomeBanner from 'app/plugins/panel/welcome/module';
import * as xyChartPanel from 'app/plugins/panel/xychart/module';
// Async loaded panels
const geomapPanel = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "geomapPanel" */ 'app/plugins/panel/geomap/module'); });
const canvasPanel = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "canvasPanel" */ 'app/plugins/panel/canvas/module'); });
const graphPanel = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "graphPlugin" */ 'app/plugins/panel/graph/module'); });
const heatmapPanel = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "heatmapPanel" */ 'app/plugins/panel/heatmap/module'); });
const tableOldPanel = () => __awaiter(void 0, void 0, void 0, function* () { return yield import(/* webpackChunkName: "tableOldPlugin" */ 'app/plugins/panel/table-old/module'); });
const builtInPlugins = {
    // datasources
    'core:plugin/graphite': graphitePlugin,
    'core:plugin/cloudwatch': cloudwatchPlugin,
    'core:plugin/dashboard': dashboardDSPlugin,
    'core:plugin/elasticsearch': elasticsearchPlugin,
    'core:plugin/opentsdb': opentsdbPlugin,
    'core:plugin/grafana': grafanaPlugin,
    'core:plugin/influxdb': influxdbPlugin,
    'core:plugin/loki': lokiPlugin,
    'core:plugin/jaeger': jaegerPlugin,
    'core:plugin/zipkin': zipkinPlugin,
    'core:plugin/mixed': mixedPlugin,
    'core:plugin/mysql': mysqlPlugin,
    'core:plugin/postgres': postgresPlugin,
    'core:plugin/mssql': mssqlPlugin,
    'core:plugin/prometheus': prometheusPlugin,
    'core:plugin/grafana-testdata-datasource': testDataDSPlugin,
    'core:plugin/cloud-monitoring': cloudMonitoringPlugin,
    'core:plugin/azuremonitor': azureMonitorPlugin,
    'core:plugin/tempo': tempoPlugin,
    'core:plugin/alertmanager': alertmanagerPlugin,
    'core:plugin/grafana-pyroscope-datasource': pyroscopePlugin,
    'core:plugin/parca': parcaPlugin,
    // panels
    'core:plugin/text': textPanel,
    'core:plugin/timeseries': timeseriesPanel,
    'core:plugin/trend': trendPanel,
    'core:plugin/state-timeline': stateTimelinePanel,
    'core:plugin/status-history': statusHistoryPanel,
    'core:plugin/candlestick': candlestickPanel,
    'core:plugin/graph': graphPanel,
    'core:plugin/xychart': xyChartPanel,
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
    'core:plugin/alertGroups': alertGroupsPanel,
    // @PERCONA
    'app/plugins/panel/pmm-check/module': pmmCheckPanel,
    'app/plugins/panel/pmm-update/module': pmmUpdatePanel,
};
export default builtInPlugins;
//# sourceMappingURL=built_in_plugins.js.map