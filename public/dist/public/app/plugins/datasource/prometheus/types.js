export var PrometheusCacheLevel;
(function (PrometheusCacheLevel) {
    PrometheusCacheLevel["Low"] = "Low";
    PrometheusCacheLevel["Medium"] = "Medium";
    PrometheusCacheLevel["High"] = "High";
    PrometheusCacheLevel["None"] = "None";
})(PrometheusCacheLevel || (PrometheusCacheLevel = {}));
export var PromApplication;
(function (PromApplication) {
    PromApplication["Cortex"] = "Cortex";
    PromApplication["Mimir"] = "Mimir";
    PromApplication["Prometheus"] = "Prometheus";
    PromApplication["Thanos"] = "Thanos";
})(PromApplication || (PromApplication = {}));
export function isMatrixData(result) {
    return 'values' in result;
}
export function isExemplarData(result) {
    if (result == null || !Array.isArray(result)) {
        return false;
    }
    return result.length ? 'exemplars' in result[0] : false;
}
/**
 * Auto = query.legendFormat == '__auto'
 * Verbose = query.legendFormat == null/undefined/''
 * Custom query.legendFormat.length > 0 && query.legendFormat !== '__auto'
 */
export var LegendFormatMode;
(function (LegendFormatMode) {
    LegendFormatMode["Auto"] = "__auto";
    LegendFormatMode["Verbose"] = "__verbose";
    LegendFormatMode["Custom"] = "__custom";
})(LegendFormatMode || (LegendFormatMode = {}));
export var PromVariableQueryType;
(function (PromVariableQueryType) {
    PromVariableQueryType[PromVariableQueryType["LabelNames"] = 0] = "LabelNames";
    PromVariableQueryType[PromVariableQueryType["LabelValues"] = 1] = "LabelValues";
    PromVariableQueryType[PromVariableQueryType["MetricNames"] = 2] = "MetricNames";
    PromVariableQueryType[PromVariableQueryType["VarQueryResult"] = 3] = "VarQueryResult";
    PromVariableQueryType[PromVariableQueryType["SeriesQuery"] = 4] = "SeriesQuery";
    PromVariableQueryType[PromVariableQueryType["ClassicQuery"] = 5] = "ClassicQuery";
})(PromVariableQueryType || (PromVariableQueryType = {}));
//# sourceMappingURL=types.js.map