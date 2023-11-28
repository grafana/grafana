//----------------------------------------------
// Query
//----------------------------------------------
export var GrafanaQueryType;
(function (GrafanaQueryType) {
    GrafanaQueryType["LiveMeasurements"] = "measurements";
    GrafanaQueryType["Annotations"] = "annotations";
    GrafanaQueryType["Snapshot"] = "snapshot";
    GrafanaQueryType["TimeRegions"] = "timeRegions";
    // backend
    GrafanaQueryType["RandomWalk"] = "randomWalk";
    GrafanaQueryType["List"] = "list";
    GrafanaQueryType["Read"] = "read";
    GrafanaQueryType["Search"] = "search";
})(GrafanaQueryType || (GrafanaQueryType = {}));
export const defaultQuery = {
    refId: 'A',
    queryType: GrafanaQueryType.RandomWalk,
};
export const defaultFileUploadQuery = {
    refId: 'A',
    datasource: {
        type: 'grafana',
        uid: 'grafana',
    },
    queryType: GrafanaQueryType.Snapshot,
    snapshot: [],
};
//----------------------------------------------
// Annotations
//----------------------------------------------
export var GrafanaAnnotationType;
(function (GrafanaAnnotationType) {
    GrafanaAnnotationType["Dashboard"] = "dashboard";
    GrafanaAnnotationType["Tags"] = "tags";
})(GrafanaAnnotationType || (GrafanaAnnotationType = {}));
//# sourceMappingURL=types.js.map