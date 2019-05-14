import * as tslib_1 from "tslib";
import { getBackendSrv } from '../../../core/services/backend_srv';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadPlugins"] = "LOAD_PLUGINS";
    ActionTypes["LoadPluginDashboards"] = "LOAD_PLUGIN_DASHBOARDS";
    ActionTypes["LoadedPluginDashboards"] = "LOADED_PLUGIN_DASHBOARDS";
    ActionTypes["SetPluginsSearchQuery"] = "SET_PLUGIN_SEARCH_QUERY";
    ActionTypes["SetLayoutMode"] = "SET_LAYOUT_MODE";
})(ActionTypes || (ActionTypes = {}));
export var setPluginsLayoutMode = function (mode) { return ({
    type: ActionTypes.SetLayoutMode,
    payload: mode,
}); };
export var setPluginsSearchQuery = function (query) { return ({
    type: ActionTypes.SetPluginsSearchQuery,
    payload: query,
}); };
var pluginsLoaded = function (plugins) { return ({
    type: ActionTypes.LoadPlugins,
    payload: plugins,
}); };
var pluginDashboardsLoad = function () { return ({
    type: ActionTypes.LoadPluginDashboards,
}); };
var pluginDashboardsLoaded = function (dashboards) { return ({
    type: ActionTypes.LoadedPluginDashboards,
    payload: dashboards,
}); };
export function loadPlugins() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var result;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('api/plugins', { embedded: 0 })];
                case 1:
                    result = _a.sent();
                    dispatch(pluginsLoaded(result));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadPluginDashboards() {
    var _this = this;
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var dataSourceType, response;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dispatch(pluginDashboardsLoad());
                    dataSourceType = getStore().dataSources.dataSource.type;
                    return [4 /*yield*/, getBackendSrv().get("api/plugins/" + dataSourceType + "/dashboards")];
                case 1:
                    response = _a.sent();
                    dispatch(pluginDashboardsLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map