export var AuthType;
(function (AuthType) {
    AuthType["JWT"] = "jwt";
    AuthType["GCE"] = "gce";
})(AuthType || (AuthType = {}));
export var authTypes = [
    { label: 'Google JWT File', value: AuthType.JWT },
    { label: 'GCE Default Service Account', value: AuthType.GCE },
];
export var MetricFindQueryTypes;
(function (MetricFindQueryTypes) {
    MetricFindQueryTypes["Projects"] = "projects";
    MetricFindQueryTypes["Services"] = "services";
    MetricFindQueryTypes["DefaultProject"] = "defaultProject";
    MetricFindQueryTypes["MetricTypes"] = "metricTypes";
    MetricFindQueryTypes["LabelKeys"] = "labelKeys";
    MetricFindQueryTypes["LabelValues"] = "labelValues";
    MetricFindQueryTypes["ResourceTypes"] = "resourceTypes";
    MetricFindQueryTypes["Aggregations"] = "aggregations";
    MetricFindQueryTypes["Aligners"] = "aligners";
    MetricFindQueryTypes["AlignmentPeriods"] = "alignmentPeriods";
    MetricFindQueryTypes["Selectors"] = "selectors";
    MetricFindQueryTypes["SLOServices"] = "sloServices";
    MetricFindQueryTypes["SLO"] = "slo";
})(MetricFindQueryTypes || (MetricFindQueryTypes = {}));
export var QueryType;
(function (QueryType) {
    QueryType["METRICS"] = "metrics";
    QueryType["SLO"] = "slo";
})(QueryType || (QueryType = {}));
export var EditorMode;
(function (EditorMode) {
    EditorMode["Visual"] = "visual";
    EditorMode["MQL"] = "mql";
})(EditorMode || (EditorMode = {}));
export var PreprocessorType;
(function (PreprocessorType) {
    PreprocessorType["None"] = "none";
    PreprocessorType["Rate"] = "rate";
    PreprocessorType["Delta"] = "delta";
})(PreprocessorType || (PreprocessorType = {}));
export var MetricKind;
(function (MetricKind) {
    MetricKind["METRIC_KIND_UNSPECIFIED"] = "METRIC_KIND_UNSPECIFIED";
    MetricKind["GAUGE"] = "GAUGE";
    MetricKind["DELTA"] = "DELTA";
    MetricKind["CUMULATIVE"] = "CUMULATIVE";
})(MetricKind || (MetricKind = {}));
export var ValueTypes;
(function (ValueTypes) {
    ValueTypes["VALUE_TYPE_UNSPECIFIED"] = "VALUE_TYPE_UNSPECIFIED";
    ValueTypes["BOOL"] = "BOOL";
    ValueTypes["INT64"] = "INT64";
    ValueTypes["DOUBLE"] = "DOUBLE";
    ValueTypes["STRING"] = "STRING";
    ValueTypes["DISTRIBUTION"] = "DISTRIBUTION";
    ValueTypes["MONEY"] = "MONEY";
})(ValueTypes || (ValueTypes = {}));
export var AlignmentTypes;
(function (AlignmentTypes) {
    AlignmentTypes["ALIGN_DELTA"] = "ALIGN_DELTA";
    AlignmentTypes["ALIGN_RATE"] = "ALIGN_RATE";
    AlignmentTypes["ALIGN_INTERPOLATE"] = "ALIGN_INTERPOLATE";
    AlignmentTypes["ALIGN_NEXT_OLDER"] = "ALIGN_NEXT_OLDER";
    AlignmentTypes["ALIGN_MIN"] = "ALIGN_MIN";
    AlignmentTypes["ALIGN_MAX"] = "ALIGN_MAX";
    AlignmentTypes["ALIGN_MEAN"] = "ALIGN_MEAN";
    AlignmentTypes["ALIGN_COUNT"] = "ALIGN_COUNT";
    AlignmentTypes["ALIGN_SUM"] = "ALIGN_SUM";
    AlignmentTypes["ALIGN_STDDEV"] = "ALIGN_STDDEV";
    AlignmentTypes["ALIGN_COUNT_TRUE"] = "ALIGN_COUNT_TRUE";
    AlignmentTypes["ALIGN_COUNT_FALSE"] = "ALIGN_COUNT_FALSE";
    AlignmentTypes["ALIGN_FRACTION_TRUE"] = "ALIGN_FRACTION_TRUE";
    AlignmentTypes["ALIGN_PERCENTILE_99"] = "ALIGN_PERCENTILE_99";
    AlignmentTypes["ALIGN_PERCENTILE_95"] = "ALIGN_PERCENTILE_95";
    AlignmentTypes["ALIGN_PERCENTILE_50"] = "ALIGN_PERCENTILE_50";
    AlignmentTypes["ALIGN_PERCENTILE_05"] = "ALIGN_PERCENTILE_05";
    AlignmentTypes["ALIGN_PERCENT_CHANGE"] = "ALIGN_PERCENT_CHANGE";
})(AlignmentTypes || (AlignmentTypes = {}));
//# sourceMappingURL=types.js.map