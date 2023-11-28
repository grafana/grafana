import { config, reportInteraction } from '@grafana/runtime';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from './guards';
import { migrateMetricQuery } from './migrations/metricQueryMigrations';
import pluginJson from './plugin.json';
import { MetricEditorMode, MetricQueryType, } from './types';
import { filterMetricsQuery } from './utils/utils';
export const onDashboardLoadedHandler = ({ payload: { dashboardId, orgId, grafanaVersion, queries }, }) => {
    var _a;
    try {
        const cloudWatchQueries = queries[pluginJson.id];
        if (!(cloudWatchQueries === null || cloudWatchQueries === void 0 ? void 0 : cloudWatchQueries.length)) {
            return;
        }
        let logsQueries = [];
        let metricsQueries = [];
        for (const query of cloudWatchQueries) {
            if (query.hide) {
                continue;
            }
            if (isCloudWatchLogsQuery(query)) {
                ((_a = query.logGroupNames) === null || _a === void 0 ? void 0 : _a.length) && logsQueries.push(query);
            }
            else if (isCloudWatchMetricsQuery(query)) {
                const migratedQuery = migrateMetricQuery(query);
                filterMetricsQuery(migratedQuery) && metricsQueries.push(query);
            }
        }
        const e = {
            grafana_version: grafanaVersion,
            dashboard_id: dashboardId,
            org_id: orgId,
            logs_queries_count: logsQueries === null || logsQueries === void 0 ? void 0 : logsQueries.length,
            metrics_queries_count: metricsQueries === null || metricsQueries === void 0 ? void 0 : metricsQueries.length,
            metrics_search_count: 0,
            metrics_search_builder_count: 0,
            metrics_search_code_count: 0,
            metrics_search_match_exact_count: 0,
            metrics_query_count: 0,
            metrics_query_builder_count: 0,
            metrics_query_code_count: 0,
            metrics_queries_with_account_count: 0,
        };
        for (const q of metricsQueries) {
            e.metrics_search_count += +Boolean(q.metricQueryType === MetricQueryType.Search);
            e.metrics_search_builder_count += +isMetricSearchBuilder(q);
            e.metrics_search_code_count += +Boolean(q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Code);
            e.metrics_search_match_exact_count += +Boolean(isMetricSearchBuilder(q) && q.matchExact);
            e.metrics_query_count += +Boolean(q.metricQueryType === MetricQueryType.Query);
            e.metrics_query_builder_count += +Boolean(q.metricQueryType === MetricQueryType.Query && q.metricEditorMode === MetricEditorMode.Builder);
            e.metrics_query_code_count += +Boolean(q.metricQueryType === MetricQueryType.Query && q.metricEditorMode === MetricEditorMode.Code);
            e.metrics_queries_with_account_count += +Boolean(config.featureToggles.cloudWatchCrossAccountQuerying && isMetricSearchBuilder(q) && q.accountId);
        }
        reportInteraction('grafana_ds_cloudwatch_dashboard_loaded', e);
    }
    catch (error) {
        console.error('error in cloudwatch tracking handler', error);
    }
};
const isMetricSearchBuilder = (q) => Boolean(q.metricQueryType === MetricQueryType.Search && q.metricEditorMode === MetricEditorMode.Builder);
//# sourceMappingURL=tracking.js.map