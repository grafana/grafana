import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { config } from 'app/core/config';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { loadPanelPlugin as loadPanelPluginNew, loadPluginDashboards as loadPluginDashboardsNew, } from '../admin/state/actions';
import { pluginDashboardsLoad, pluginDashboardsLoaded, pluginsLoaded, panelPluginLoaded, pluginsErrorsLoaded, } from './reducers';
export function loadPlugins() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var plugins;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('api/plugins', { embedded: 0 })];
                case 1:
                    plugins = _a.sent();
                    dispatch(pluginsLoaded(plugins));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadPluginsErrors() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var errors;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('api/plugins/errors')];
                case 1:
                    errors = _a.sent();
                    dispatch(pluginsErrorsLoaded(errors));
                    return [2 /*return*/];
            }
        });
    }); };
}
function loadPluginDashboardsOriginal() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dataSourceType, response;
        return __generator(this, function (_a) {
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
function loadPanelPluginOriginal(pluginId) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var plugin;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    plugin = getStore().plugins.panels[pluginId];
                    if (!!plugin) return [3 /*break*/, 2];
                    return [4 /*yield*/, importPanelPlugin(pluginId)];
                case 1:
                    plugin = _a.sent();
                    // second check to protect against raise condition
                    if (!getStore().plugins.panels[pluginId]) {
                        dispatch(panelPluginLoaded(plugin));
                    }
                    _a.label = 2;
                case 2: return [2 /*return*/, plugin];
            }
        });
    }); };
}
export var loadPluginDashboards = config.pluginAdminEnabled ? loadPluginDashboardsNew : loadPluginDashboardsOriginal;
export var loadPanelPlugin = config.pluginAdminEnabled ? loadPanelPluginNew : loadPanelPluginOriginal;
//# sourceMappingURL=actions.js.map