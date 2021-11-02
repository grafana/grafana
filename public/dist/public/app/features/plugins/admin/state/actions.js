import { __awaiter, __generator, __read } from "tslib";
import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { getBackendSrv } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
import { getRemotePlugins, getPluginErrors, getLocalPlugins, getPluginDetails, installPlugin, uninstallPlugin, } from '../api';
import { STATE_PREFIX } from '../constants';
import { mergeLocalsAndRemotes, updatePanels } from '../helpers';
export var fetchAll = createAsyncThunk(STATE_PREFIX + "/fetchAll", function (_, thunkApi) { return __awaiter(void 0, void 0, void 0, function () {
    var dispatch, _a, localPlugins, pluginErrors, remotePlugins, e_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                dispatch = thunkApi.dispatch;
                return [4 /*yield*/, Promise.all([
                        getLocalPlugins(),
                        getPluginErrors(),
                        dispatch(fetchRemotePlugins()),
                    ])];
            case 1:
                _a = __read.apply(void 0, [_b.sent(), 3]), localPlugins = _a[0], pluginErrors = _a[1], remotePlugins = _a[2].payload;
                return [2 /*return*/, mergeLocalsAndRemotes(localPlugins, remotePlugins, pluginErrors)];
            case 2:
                e_1 = _b.sent();
                return [2 /*return*/, thunkApi.rejectWithValue('Unknown error.')];
            case 3: return [2 /*return*/];
        }
    });
}); });
export var fetchRemotePlugins = createAsyncThunk(STATE_PREFIX + "/fetchRemotePlugins", function (_, thunkApi) { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, getRemotePlugins()];
            case 1: return [2 /*return*/, _a.sent()];
            case 2:
                error_1 = _a.sent();
                error_1.isHandled = true;
                return [2 /*return*/, thunkApi.rejectWithValue([])];
            case 3: return [2 /*return*/];
        }
    });
}); });
export var fetchDetails = createAsyncThunk(STATE_PREFIX + "/fetchDetails", function (id, thunkApi) { return __awaiter(void 0, void 0, void 0, function () {
    var details, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, getPluginDetails(id)];
            case 1:
                details = _a.sent();
                return [2 /*return*/, {
                        id: id,
                        changes: { details: details },
                    }];
            case 2:
                e_2 = _a.sent();
                return [2 /*return*/, thunkApi.rejectWithValue('Unknown error.')];
            case 3: return [2 /*return*/];
        }
    });
}); });
// We are also using the install API endpoint to update the plugin
export var install = createAsyncThunk(STATE_PREFIX + "/install", function (_a, thunkApi) {
    var id = _a.id, version = _a.version, _b = _a.isUpdating, isUpdating = _b === void 0 ? false : _b;
    return __awaiter(void 0, void 0, void 0, function () {
        var changes, e_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    changes = isUpdating ? { isInstalled: true, hasUpdate: false } : { isInstalled: true };
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, installPlugin(id, version)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, updatePanels()];
                case 3:
                    _c.sent();
                    return [2 /*return*/, { id: id, changes: changes }];
                case 4:
                    e_3 = _c.sent();
                    return [2 /*return*/, thunkApi.rejectWithValue('Unknown error.')];
                case 5: return [2 /*return*/];
            }
        });
    });
});
export var uninstall = createAsyncThunk(STATE_PREFIX + "/uninstall", function (id, thunkApi) { return __awaiter(void 0, void 0, void 0, function () {
    var e_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, uninstallPlugin(id)];
            case 1:
                _a.sent();
                return [4 /*yield*/, updatePanels()];
            case 2:
                _a.sent();
                return [2 /*return*/, {
                        id: id,
                        changes: { isInstalled: false },
                    }];
            case 3:
                e_4 = _a.sent();
                return [2 /*return*/, thunkApi.rejectWithValue('Unknown error.')];
            case 4: return [2 /*return*/];
        }
    });
}); });
// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export var loadPluginDashboards = createAsyncThunk(STATE_PREFIX + "/loadPluginDashboards", function (_, thunkApi) { return __awaiter(void 0, void 0, void 0, function () {
    var state, dataSourceType, url;
    return __generator(this, function (_a) {
        state = thunkApi.getState();
        dataSourceType = state.dataSources.dataSource.type;
        url = "api/plugins/" + dataSourceType + "/dashboards";
        return [2 /*return*/, getBackendSrv().get(url)];
    });
}); });
export var panelPluginLoaded = createAction(STATE_PREFIX + "/panelPluginLoaded");
// We need this to be backwards-compatible with other parts of Grafana.
// (Originally in "public/app/features/plugins/state/actions.ts")
// It cannot be constructed with `createAsyncThunk()` as we need the return value on the call-site,
// and we cannot easily change the call-site to unwrap the result.
// TODO<remove once the "plugin_admin_enabled" feature flag is removed>
export var loadPanelPlugin = function (id) {
    return function (dispatch, getStore) { return __awaiter(void 0, void 0, void 0, function () {
        var plugin;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    plugin = getStore().plugins.panels[id];
                    if (!!plugin) return [3 /*break*/, 2];
                    return [4 /*yield*/, importPanelPlugin(id)];
                case 1:
                    plugin = _a.sent();
                    // second check to protect against raise condition
                    if (!getStore().plugins.panels[id]) {
                        dispatch(panelPluginLoaded(plugin));
                    }
                    _a.label = 2;
                case 2: return [2 /*return*/, plugin];
            }
        });
    }); };
};
//# sourceMappingURL=actions.js.map