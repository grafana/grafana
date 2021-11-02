/**
 * Mapping of log level abbreviation to canonical log level.
 * Supported levels are reduce to limit color variation.
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["emerg"] = "critical";
    LogLevel["fatal"] = "critical";
    LogLevel["alert"] = "critical";
    LogLevel["crit"] = "critical";
    LogLevel["critical"] = "critical";
    LogLevel["warn"] = "warning";
    LogLevel["warning"] = "warning";
    LogLevel["err"] = "error";
    LogLevel["eror"] = "error";
    LogLevel["error"] = "error";
    LogLevel["info"] = "info";
    LogLevel["information"] = "info";
    LogLevel["informational"] = "info";
    LogLevel["notice"] = "info";
    LogLevel["dbug"] = "debug";
    LogLevel["debug"] = "debug";
    LogLevel["trace"] = "trace";
    LogLevel["unknown"] = "unknown";
})(LogLevel || (LogLevel = {}));
// Used for meta information such as common labels or returned log rows in logs view in Explore
export var LogsMetaKind;
(function (LogsMetaKind) {
    LogsMetaKind[LogsMetaKind["Number"] = 0] = "Number";
    LogsMetaKind[LogsMetaKind["String"] = 1] = "String";
    LogsMetaKind[LogsMetaKind["LabelsMap"] = 2] = "LabelsMap";
    LogsMetaKind[LogsMetaKind["Error"] = 3] = "Error";
})(LogsMetaKind || (LogsMetaKind = {}));
export var LogsSortOrder;
(function (LogsSortOrder) {
    LogsSortOrder["Descending"] = "Descending";
    LogsSortOrder["Ascending"] = "Ascending";
})(LogsSortOrder || (LogsSortOrder = {}));
export var LogsDedupStrategy;
(function (LogsDedupStrategy) {
    LogsDedupStrategy["none"] = "none";
    LogsDedupStrategy["exact"] = "exact";
    LogsDedupStrategy["numbers"] = "numbers";
    LogsDedupStrategy["signature"] = "signature";
})(LogsDedupStrategy || (LogsDedupStrategy = {}));
export var LogsDedupDescription;
(function (LogsDedupDescription) {
    LogsDedupDescription["none"] = "No de-duplication";
    LogsDedupDescription["exact"] = "De-duplication of successive lines that are identical, ignoring ISO datetimes.";
    LogsDedupDescription["numbers"] = "De-duplication of successive lines that are identical when ignoring numbers, e.g., IP addresses, latencies.";
    LogsDedupDescription["signature"] = "De-duplication of successive lines that have identical punctuation and whitespace.";
})(LogsDedupDescription || (LogsDedupDescription = {}));
/**
 * @alpha
 */
export var hasLogsContextSupport = function (datasource) {
    if (!datasource) {
        return false;
    }
    var withLogsSupport = datasource;
    return withLogsSupport.getLogRowContext !== undefined && withLogsSupport.showContextToggle !== undefined;
};
//# sourceMappingURL=logs.js.map