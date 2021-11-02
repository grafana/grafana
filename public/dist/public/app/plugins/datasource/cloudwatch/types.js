export var CloudWatchLogsQueryStatus;
(function (CloudWatchLogsQueryStatus) {
    CloudWatchLogsQueryStatus["Scheduled"] = "Scheduled";
    CloudWatchLogsQueryStatus["Running"] = "Running";
    CloudWatchLogsQueryStatus["Complete"] = "Complete";
    CloudWatchLogsQueryStatus["Failed"] = "Failed";
    CloudWatchLogsQueryStatus["Cancelled"] = "Cancelled";
    CloudWatchLogsQueryStatus["Timeout"] = "Timeout";
})(CloudWatchLogsQueryStatus || (CloudWatchLogsQueryStatus = {}));
export var isCloudWatchLogsQuery = function (cloudwatchQuery) {
    return cloudwatchQuery.queryMode === 'Logs';
};
//# sourceMappingURL=types.js.map