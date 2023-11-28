import { MetricEditorMode, MetricQueryType, VariableQueryType, } from './types';
export const DEFAULT_METRICS_QUERY = {
    queryMode: 'Metrics',
    namespace: '',
    metricName: '',
    expression: '',
    dimensions: {},
    region: 'default',
    id: '',
    statistic: 'Average',
    period: '',
    metricQueryType: MetricQueryType.Search,
    metricEditorMode: MetricEditorMode.Builder,
    sqlExpression: '',
    matchExact: true,
};
export const DEFAULT_ANNOTATIONS_QUERY = {
    queryMode: 'Annotations',
    namespace: '',
    region: 'default',
    statistic: 'Average',
};
export const DEFAULT_LOGS_QUERY_STRING = 'fields @timestamp, @message |\n sort @timestamp desc |\n limit 20';
export const getDefaultLogsQuery = (defaultLogGroups, legacyDefaultLogGroups) => ({
    id: '',
    region: 'default',
    // in case legacy default log groups have been defined in the ConfigEditor, they will be migrated in the LogGroupsField component or the next time the ConfigEditor is opened.
    // the migration requires async backend calls, so we don't want to do it here as it would block the UI.
    logGroupNames: legacyDefaultLogGroups,
    logGroups: defaultLogGroups !== null && defaultLogGroups !== void 0 ? defaultLogGroups : [],
});
export const DEFAULT_VARIABLE_QUERY = {
    queryType: VariableQueryType.Regions,
    region: 'default',
};
//# sourceMappingURL=defaultQueries.js.map