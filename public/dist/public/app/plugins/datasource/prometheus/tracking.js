import { CoreApp } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';
export function trackQuery(response, request, startTime) {
    var _a, _b, _c, _d;
    const { app, targets: queries } = request;
    // We do want to track panel-editor and explore
    // We do not want to track queries from the dashboard or viewing a panel
    // also included in the tracking is cloud-alerting, unified-alerting, and unknown
    if (app === CoreApp.Dashboard || app === CoreApp.PanelViewer) {
        return;
    }
    for (const query of queries) {
        reportInteraction('grafana_prometheus_query_executed', {
            app,
            grafana_version: config.buildInfo.version,
            has_data: response.data.some((frame) => frame.length > 0),
            has_error: response.error !== undefined,
            expr: query.expr,
            format: query.format,
            instant: query.instant,
            range: query.range,
            exemplar: query.exemplar,
            hinting: query.hinting,
            interval: query.interval,
            intervalFactor: query.intervalFactor,
            utcOffsetSec: query.utcOffsetSec,
            legend: query.legendFormat,
            valueWithRefId: query.valueWithRefId,
            requestId: request.requestId,
            showingGraph: query.showingGraph,
            showingTable: query.showingTable,
            editor_mode: query.editorMode,
            simultaneously_sent_query_count: queries.length,
            time_range_from: (_b = (_a = request === null || request === void 0 ? void 0 : request.range) === null || _a === void 0 ? void 0 : _a.from) === null || _b === void 0 ? void 0 : _b.toISOString(),
            time_range_to: (_d = (_c = request === null || request === void 0 ? void 0 : request.range) === null || _c === void 0 ? void 0 : _c.to) === null || _d === void 0 ? void 0 : _d.toISOString(),
            time_taken: Date.now() - startTime.getTime(),
        });
    }
}
//# sourceMappingURL=tracking.js.map