//----------------------------------------------
// Query
//----------------------------------------------
export var GrafanaQueryType;
(function (GrafanaQueryType) {
    GrafanaQueryType["LiveMeasurements"] = "measurements";
    GrafanaQueryType["Annotations"] = "annotations";
    // backend
    GrafanaQueryType["RandomWalk"] = "randomWalk";
    GrafanaQueryType["List"] = "list";
    GrafanaQueryType["Read"] = "read";
})(GrafanaQueryType || (GrafanaQueryType = {}));
export var defaultQuery = {
    refId: 'A',
    queryType: GrafanaQueryType.RandomWalk,
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