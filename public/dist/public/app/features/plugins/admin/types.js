export var PluginListDisplayMode;
(function (PluginListDisplayMode) {
    PluginListDisplayMode["Grid"] = "grid";
    PluginListDisplayMode["List"] = "list";
})(PluginListDisplayMode || (PluginListDisplayMode = {}));
export var PluginAdminRoutes;
(function (PluginAdminRoutes) {
    PluginAdminRoutes["Home"] = "plugins-home";
    PluginAdminRoutes["Browse"] = "plugins-browse";
    PluginAdminRoutes["Details"] = "plugins-details";
})(PluginAdminRoutes || (PluginAdminRoutes = {}));
export var PluginIconName;
(function (PluginIconName) {
    PluginIconName["app"] = "apps";
    PluginIconName["datasource"] = "database";
    PluginIconName["panel"] = "credit-card";
    PluginIconName["renderer"] = "capture";
    PluginIconName["secretsmanager"] = "key-skeleton-alt";
})(PluginIconName || (PluginIconName = {}));
// The available status codes on GCOM are available here:
// https://github.com/grafana/grafana-com/blob/main/packages/grafana-com-plugins-api/src/plugins/plugin.model.js#L74
export var RemotePluginStatus;
(function (RemotePluginStatus) {
    RemotePluginStatus["Deleted"] = "deleted";
    RemotePluginStatus["Active"] = "active";
    RemotePluginStatus["Pending"] = "pending";
    RemotePluginStatus["Deprecated"] = "deprecated";
    RemotePluginStatus["Enterprise"] = "enterprise";
})(RemotePluginStatus || (RemotePluginStatus = {}));
export var PluginStatus;
(function (PluginStatus) {
    PluginStatus["INSTALL"] = "INSTALL";
    PluginStatus["UNINSTALL"] = "UNINSTALL";
    PluginStatus["UPDATE"] = "UPDATE";
    PluginStatus["REINSTALL"] = "REINSTALL";
})(PluginStatus || (PluginStatus = {}));
export var PluginTabLabels;
(function (PluginTabLabels) {
    PluginTabLabels["OVERVIEW"] = "Overview";
    PluginTabLabels["VERSIONS"] = "Version history";
    PluginTabLabels["CONFIG"] = "Config";
    PluginTabLabels["DASHBOARDS"] = "Dashboards";
    PluginTabLabels["USAGE"] = "Usage";
})(PluginTabLabels || (PluginTabLabels = {}));
export var PluginTabIds;
(function (PluginTabIds) {
    PluginTabIds["OVERVIEW"] = "overview";
    PluginTabIds["VERSIONS"] = "version-history";
    PluginTabIds["CONFIG"] = "config";
    PluginTabIds["DASHBOARDS"] = "dashboards";
    PluginTabIds["USAGE"] = "usage";
})(PluginTabIds || (PluginTabIds = {}));
export var RequestStatus;
(function (RequestStatus) {
    RequestStatus["Pending"] = "Pending";
    RequestStatus["Fulfilled"] = "Fulfilled";
    RequestStatus["Rejected"] = "Rejected";
})(RequestStatus || (RequestStatus = {}));
//# sourceMappingURL=types.js.map