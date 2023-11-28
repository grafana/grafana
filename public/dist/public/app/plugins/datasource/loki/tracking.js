import { CoreApp } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';
import { variableRegex } from 'app/features/variables/utils';
import { QueryEditorMode } from '../prometheus/querybuilder/shared/types';
import { REF_ID_STARTER_ANNOTATION, REF_ID_DATA_SAMPLES, REF_ID_STARTER_LOG_ROW_CONTEXT, REF_ID_STARTER_LOG_VOLUME, } from './datasource';
import pluginJson from './plugin.json';
import { getNormalizedLokiQuery, isLogsQuery, obfuscate, parseToNodeNamesArray } from './queryUtils';
import { LokiQueryType } from './types';
export const onDashboardLoadedHandler = ({ payload: { dashboardId, orgId, grafanaVersion, queries }, }) => {
    try {
        // We only want to track visible Loki queries
        const lokiQueries = queries[pluginJson.id]
            .filter((query) => !query.hide)
            .map((query) => getNormalizedLokiQuery(query));
        if (!(lokiQueries === null || lokiQueries === void 0 ? void 0 : lokiQueries.length)) {
            return;
        }
        const logsQueries = lokiQueries.filter((query) => isLogsQuery(query.expr));
        const metricQueries = lokiQueries.filter((query) => !isLogsQuery(query.expr));
        const instantQueries = lokiQueries.filter((query) => query.queryType === LokiQueryType.Instant);
        const rangeQueries = lokiQueries.filter((query) => query.queryType === LokiQueryType.Range);
        const builderModeQueries = lokiQueries.filter((query) => query.editorMode === QueryEditorMode.Builder);
        const codeModeQueries = lokiQueries.filter((query) => query.editorMode === QueryEditorMode.Code);
        const queriesWithTemplateVariables = lokiQueries.filter(isQueryWithTemplateVariables);
        const queriesWithChangedResolution = lokiQueries.filter(isQueryWithChangedResolution);
        const queriesWithChangedLineLimit = lokiQueries.filter(isQueryWithChangedLineLimit);
        const queriesWithChangedLegend = lokiQueries.filter(isQueryWithChangedLegend);
        const event = {
            grafana_version: grafanaVersion,
            dashboard_id: dashboardId,
            org_id: orgId,
            queries_count: lokiQueries.length,
            logs_queries_count: logsQueries.length,
            metric_queries_count: metricQueries.length,
            instant_queries_count: instantQueries.length,
            range_queries_count: rangeQueries.length,
            builder_mode_queries_count: builderModeQueries.length,
            code_mode_queries_count: codeModeQueries.length,
            queries_with_template_variables_count: queriesWithTemplateVariables.length,
            queries_with_changed_resolution_count: queriesWithChangedResolution.length,
            queries_with_changed_line_limit_count: queriesWithChangedLineLimit.length,
            queries_with_changed_legend_count: queriesWithChangedLegend.length,
        };
        reportInteraction('grafana_loki_dashboard_loaded', event);
    }
    catch (error) {
        console.error('error in loki tracking handler', error);
    }
};
const isQueryWithTemplateVariables = (query) => {
    return variableRegex.test(query.expr);
};
const isQueryWithChangedResolution = (query) => {
    if (!query.resolution) {
        return false;
    }
    // 1 is the default resolution
    return query.resolution !== 1;
};
const isQueryWithChangedLineLimit = (query) => {
    return query.maxLines !== null && query.maxLines !== undefined;
};
const isQueryWithChangedLegend = (query) => {
    if (!query.legendFormat) {
        return false;
    }
    return query.legendFormat !== '';
};
const shouldNotReportBasedOnRefId = (refId) => {
    const starters = [REF_ID_STARTER_ANNOTATION, REF_ID_STARTER_LOG_ROW_CONTEXT, REF_ID_STARTER_LOG_VOLUME];
    if (refId === REF_ID_DATA_SAMPLES || starters.some((starter) => refId.startsWith(starter))) {
        return true;
    }
    return false;
};
const calculateTotalBytes = (response) => {
    var _a, _b, _c, _d, _e, _f;
    let totalBytes = 0;
    for (const frame of response.data) {
        const byteKey = (_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.lokiQueryStatKey;
        if (byteKey) {
            totalBytes +=
                (_f = (_e = (_d = (_c = frame.meta) === null || _c === void 0 ? void 0 : _c.stats) === null || _d === void 0 ? void 0 : _d.find((stat) => stat.displayName === byteKey)) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : 0;
        }
    }
    return totalBytes;
};
export function trackQuery(response, request, startTime, trackingSettings = {}, extraPayload = {}) {
    var _a, _b, _c, _d;
    // We only want to track usage for these specific apps
    const { app, targets: queries } = request;
    if (app === CoreApp.Dashboard || app === CoreApp.PanelViewer) {
        return;
    }
    let totalBytes = calculateTotalBytes(response);
    for (const query of queries) {
        if (shouldNotReportBasedOnRefId(query.refId)) {
            return;
        }
        reportInteraction('grafana_loki_query_executed', Object.assign({ app, grafana_version: config.buildInfo.version, editor_mode: query.editorMode, has_data: response.data.some((frame) => frame.length > 0), has_error: response.error !== undefined, legend: query.legendFormat, line_limit: query.maxLines, parsed_query: parseToNodeNamesArray(query.expr).join(','), obfuscated_query: obfuscate(query.expr), query_type: isLogsQuery(query.expr) ? 'logs' : 'metric', query_vector_type: query.queryType, resolution: query.resolution, simultaneously_executed_query_count: queries.filter((query) => !query.hide).length, simultaneously_hidden_query_count: queries.filter((query) => query.hide).length, time_range_from: (_b = (_a = request === null || request === void 0 ? void 0 : request.range) === null || _a === void 0 ? void 0 : _a.from) === null || _b === void 0 ? void 0 : _b.toISOString(), time_range_to: (_d = (_c = request === null || request === void 0 ? void 0 : request.range) === null || _c === void 0 ? void 0 : _c.to) === null || _d === void 0 ? void 0 : _d.toISOString(), time_taken: Date.now() - startTime.getTime(), bytes_processed: totalBytes, is_split: false, predefined_operations_applied: trackingSettings.predefinedOperations
                ? query.expr.includes(trackingSettings.predefinedOperations)
                : 'n/a' }, extraPayload));
    }
}
export function trackGroupedQueries(response, groupedRequests, originalRequest, startTime, trackingSettings = {}) {
    const splittingPayload = {
        split_query_group_count: groupedRequests.length,
        split_query_largest_partition_size: Math.max(...groupedRequests.map(({ partition }) => partition.length)),
        split_query_total_request_count: groupedRequests.reduce((total, { partition }) => total + partition.length, 0),
        is_split: true,
        simultaneously_executed_query_count: originalRequest.targets.filter((query) => !query.hide).length,
        simultaneously_hidden_query_count: originalRequest.targets.filter((query) => query.hide).length,
    };
    for (const group of groupedRequests) {
        const split_query_partition_size = group.partition.length;
        trackQuery(response, group.request, startTime, trackingSettings, Object.assign(Object.assign({}, splittingPayload), { split_query_partition_size }));
    }
}
//# sourceMappingURL=tracking.js.map