import { __assign, __awaiter, __generator } from "tslib";
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { loadPanelPlugin } from 'app/features/plugins/state/actions';
import { panelModelAndPluginReady } from './reducers';
import { toPanelModelLibraryPanel } from 'app/features/library-panels/utils';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';
import { getPanelOptionsWithDefaults } from 'app/features/dashboard/state/getPanelOptionsWithDefaults';
export function initPanelState(panel) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var pluginToLoad, plugin, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pluginToLoad = panel.type;
                    plugin = getStore().plugins.panels[pluginToLoad];
                    if (!!plugin) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, dispatch(loadPanelPlugin(pluginToLoad))];
                case 2:
                    plugin = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    // When plugin not found
                    plugin = getPanelPluginNotFound(pluginToLoad, pluginToLoad === 'row');
                    return [3 /*break*/, 4];
                case 4:
                    if (!panel.plugin) {
                        panel.pluginLoaded(plugin);
                    }
                    dispatch(panelModelAndPluginReady({ key: panel.key, plugin: plugin }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function changePanelPlugin(_a) {
    var _this = this;
    var panel = _a.panel, pluginId = _a.pluginId, options = _a.options, fieldConfig = _a.fieldConfig;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var store, plugin, cleanUpKey, newOptions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // ignore action is no change
                    if (panel.type === pluginId && !options && !fieldConfig) {
                        return [2 /*return*/];
                    }
                    store = getStore();
                    plugin = store.plugins.panels[pluginId];
                    if (!!plugin) return [3 /*break*/, 2];
                    return [4 /*yield*/, dispatch(loadPanelPlugin(pluginId))];
                case 1:
                    plugin = _a.sent();
                    _a.label = 2;
                case 2:
                    cleanUpKey = panel.key;
                    if (panel.type !== pluginId) {
                        panel.changePlugin(plugin);
                    }
                    if (options || fieldConfig) {
                        newOptions = getPanelOptionsWithDefaults({
                            plugin: plugin,
                            currentOptions: options || panel.options,
                            currentFieldConfig: fieldConfig || panel.fieldConfig,
                            isAfterPluginChange: false,
                        });
                        panel.options = newOptions.options;
                        panel.fieldConfig = newOptions.fieldConfig;
                        panel.configRev++;
                    }
                    panel.generateNewKey();
                    dispatch(panelModelAndPluginReady({ key: panel.key, plugin: plugin, cleanUpKey: cleanUpKey }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function changeToLibraryPanel(panel, libraryPanel) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var newPluginId, oldType, store, plugin, oldKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    newPluginId = libraryPanel.model.type;
                    oldType = panel.type;
                    // Update model but preserve gridPos & id
                    panel.restoreModel(__assign(__assign({}, libraryPanel.model), { gridPos: panel.gridPos, id: panel.id, libraryPanel: toPanelModelLibraryPanel(libraryPanel.model) }));
                    // a new library panel usually means new queries, clear any current result
                    panel.getQueryRunner().clearLastResult();
                    if (!(oldType !== newPluginId)) return [3 /*break*/, 4];
                    store = getStore();
                    plugin = store.plugins.panels[newPluginId];
                    if (!!plugin) return [3 /*break*/, 2];
                    return [4 /*yield*/, dispatch(loadPanelPlugin(newPluginId))];
                case 1:
                    plugin = _a.sent();
                    _a.label = 2;
                case 2:
                    oldKey = panel.key;
                    panel.pluginLoaded(plugin);
                    panel.generateNewKey();
                    return [4 /*yield*/, dispatch(panelModelAndPluginReady({ key: panel.key, plugin: plugin, cleanUpKey: oldKey }))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    panel.configRev = 0;
                    panel.refresh();
                    panel.events.publish(PanelQueriesChangedEvent);
                    panel.events.publish(PanelOptionsChangedEvent);
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map