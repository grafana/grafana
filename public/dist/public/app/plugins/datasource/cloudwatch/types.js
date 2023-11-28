export * from './dataquery.gen';
export var CloudWatchLogsQueryStatus;
(function (CloudWatchLogsQueryStatus) {
    CloudWatchLogsQueryStatus["Scheduled"] = "Scheduled";
    CloudWatchLogsQueryStatus["Running"] = "Running";
    CloudWatchLogsQueryStatus["Complete"] = "Complete";
    CloudWatchLogsQueryStatus["Failed"] = "Failed";
    CloudWatchLogsQueryStatus["Cancelled"] = "Cancelled";
    CloudWatchLogsQueryStatus["Timeout"] = "Timeout";
})(CloudWatchLogsQueryStatus || (CloudWatchLogsQueryStatus = {}));
export var VariableQueryType;
(function (VariableQueryType) {
    VariableQueryType["Regions"] = "regions";
    VariableQueryType["Namespaces"] = "namespaces";
    VariableQueryType["Metrics"] = "metrics";
    VariableQueryType["DimensionKeys"] = "dimensionKeys";
    VariableQueryType["DimensionValues"] = "dimensionValues";
    VariableQueryType["EBSVolumeIDs"] = "ebsVolumeIDs";
    VariableQueryType["EC2InstanceAttributes"] = "ec2InstanceAttributes";
    VariableQueryType["ResourceArns"] = "resourceARNs";
    VariableQueryType["Statistics"] = "statistics";
    VariableQueryType["LogGroups"] = "logGroups";
    VariableQueryType["Accounts"] = "accounts";
})(VariableQueryType || (VariableQueryType = {}));
//# sourceMappingURL=types.js.map