import { CoreApp } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { variableRegex } from 'app/features/variables/utils';
import { REF_ID_STARTER_LOG_VOLUME } from './datasource';
import pluginJson from './plugin.json';
export const onDashboardLoadedHandler = ({ payload: { dashboardId, orgId, grafanaVersion, queries }, }) => {
    try {
        // We only want to track visible ElasticSearch queries
        const elasticsearchQueries = queries[pluginJson.id].filter((query) => !query.hide);
        if (!(elasticsearchQueries === null || elasticsearchQueries === void 0 ? void 0 : elasticsearchQueries.length)) {
            return;
        }
        const queriesWithTemplateVariables = elasticsearchQueries.filter(isQueryWithTemplateVariables);
        const queriesWithLuceneQuery = elasticsearchQueries.filter((query) => !!query.query);
        const logsQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'logs');
        const metricQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'metric');
        const rawDataQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'raw_data');
        const rawDocumentQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'raw_document');
        const queriesWithChangedLineLimit = elasticsearchQueries.filter(isQueryWithChangedLineLimit);
        const event = {
            grafana_version: grafanaVersion,
            dashboard_id: dashboardId,
            org_id: orgId,
            queries_count: elasticsearchQueries.length,
            logs_queries_count: logsQueries.length,
            metric_queries_count: metricQueries.length,
            raw_data_queries_count: rawDataQueries.length,
            raw_document_queries_count: rawDocumentQueries.length,
            queries_with_template_variables_count: queriesWithTemplateVariables.length,
            queries_with_changed_line_limit_count: queriesWithChangedLineLimit.length,
            queries_with_lucene_query_count: queriesWithLuceneQuery.length,
        };
        reportInteraction('grafana_elasticsearch_dashboard_loaded', event);
    }
    catch (error) {
        console.error('error in elasticsearch tracking handler', error);
    }
};
const getQueryType = (query) => {
    if (!query.metrics || !query.metrics.length) {
        return undefined;
    }
    const nonMetricQueryTypes = ['logs', 'raw_data', 'raw_document'];
    if (nonMetricQueryTypes.includes(query.metrics[0].type)) {
        return query.metrics[0].type;
    }
    return 'metric';
};
const getLineLimit = (query) => {
    var _a, _b, _c, _d;
    if (((_b = (_a = query.metrics) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.type) !== 'logs') {
        return undefined;
    }
    const lineLimit = (_d = (_c = query.metrics) === null || _c === void 0 ? void 0 : _c[0].settings) === null || _d === void 0 ? void 0 : _d.limit;
    return lineLimit ? parseInt(lineLimit, 10) : undefined;
};
const isQueryWithChangedLineLimit = (query) => {
    const lineLimit = getLineLimit(query);
    return lineLimit !== undefined && lineLimit !== 500;
};
const isQueryWithTemplateVariables = (query) => {
    var _a;
    return variableRegex.test((_a = query.query) !== null && _a !== void 0 ? _a : '');
};
const shouldNotReportBasedOnRefId = (refId) => {
    if (refId.startsWith(REF_ID_STARTER_LOG_VOLUME)) {
        return true;
    }
    return false;
};
export function trackQuery(response, request, startTime) {
    var _a, _b, _c, _d;
    const { targets: queries, app } = request;
    if (app === CoreApp.Dashboard || app === CoreApp.PanelViewer) {
        return;
    }
    for (const query of queries) {
        if (shouldNotReportBasedOnRefId(query.refId)) {
            return;
        }
        reportInteraction('grafana_elasticsearch_query_executed', {
            app,
            grafana_version: config.buildInfo.version,
            with_lucene_query: query.query ? true : false,
            query_type: getQueryType(query),
            line_limit: getLineLimit(query),
            alias: query.alias,
            has_error: response.error !== undefined,
            has_data: response.data.some((frame) => frame.length > 0),
            simultaneously_sent_query_count: queries.length,
            time_range_from: (_b = (_a = request === null || request === void 0 ? void 0 : request.range) === null || _a === void 0 ? void 0 : _a.from) === null || _b === void 0 ? void 0 : _b.toISOString(),
            time_range_to: (_d = (_c = request === null || request === void 0 ? void 0 : request.range) === null || _c === void 0 ? void 0 : _c.to) === null || _d === void 0 ? void 0 : _d.toISOString(),
            time_taken: Date.now() - startTime.getTime(),
        });
    }
}
export function trackAnnotationQuery(annotation) {
    var _a;
    reportInteraction('grafana_elasticsearch_annotation_query_executed', {
        grafana_version: config.buildInfo.version,
        has_target_query: !!((_a = annotation.target) === null || _a === void 0 ? void 0 : _a.query),
        has_query: !!annotation.query,
        has_time_field: !!annotation.timeField,
        has_time_end_field: !!annotation.timeEndField,
        has_tags_field: !!annotation.tagsField,
        has_text_field: !!annotation.textField,
        has_index: !!annotation.index,
    });
}
//# sourceMappingURL=tracking.js.map