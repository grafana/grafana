export const isCloudWatchLogsQuery = (cloudwatchQuery) => cloudwatchQuery.queryMode === 'Logs';
export const isCloudWatchMetricsQuery = (cloudwatchQuery) => cloudwatchQuery.queryMode === 'Metrics' || !cloudwatchQuery.hasOwnProperty('queryMode'); // in early versions of this plugin, queryMode wasn't defined in a CloudWatchMetricsQuery
export const isCloudWatchAnnotationQuery = (cloudwatchQuery) => cloudwatchQuery.queryMode === 'Annotations';
export const isCloudWatchAnnotation = (query) => { var _a; return ((_a = query.target) === null || _a === void 0 ? void 0 : _a.queryMode) === 'Annotations'; };
//# sourceMappingURL=guards.js.map