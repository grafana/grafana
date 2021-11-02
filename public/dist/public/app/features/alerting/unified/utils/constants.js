var _a;
export var RULER_NOT_SUPPORTED_MSG = 'ruler not supported';
export var RULE_LIST_POLL_INTERVAL_MS = 20000;
export var ALERTMANAGER_NAME_QUERY_KEY = 'alertmanager';
export var ALERTMANAGER_NAME_LOCAL_STORAGE_KEY = 'alerting-alertmanager';
export var SILENCES_POLL_INTERVAL_MS = 20000;
export var NOTIFICATIONS_POLL_INTERVAL_MS = 20000;
export var TIMESERIES = 'timeseries';
export var TABLE = 'table';
export var STAT = 'stat';
export var Annotation;
(function (Annotation) {
    Annotation["description"] = "description";
    Annotation["summary"] = "summary";
    Annotation["runbookURL"] = "runbook_url";
    Annotation["alertId"] = "__alertId__";
    Annotation["dashboardUID"] = "__dashboardUid__";
    Annotation["panelID"] = "__panelId__";
})(Annotation || (Annotation = {}));
export var annotationLabels = (_a = {},
    _a[Annotation.description] = 'Description',
    _a[Annotation.summary] = 'Summary',
    _a[Annotation.runbookURL] = 'Runbook URL',
    _a[Annotation.dashboardUID] = 'Dashboard UID',
    _a[Annotation.panelID] = 'Panel ID',
    _a[Annotation.alertId] = 'Alert ID',
    _a);
//# sourceMappingURL=constants.js.map