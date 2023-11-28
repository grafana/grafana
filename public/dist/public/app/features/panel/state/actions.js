import { __awaiter } from "tslib";
import { getPanelOptionsWithDefaults } from '@grafana/data';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { loadPanelPlugin } from 'app/features/plugins/admin/state/actions';
import { DashboardPanelsChangedEvent, PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';
import { changePanelKey, panelModelAndPluginReady, removePanel } from './reducers';
export function initPanelState(panel) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (((_a = panel.libraryPanel) === null || _a === void 0 ? void 0 : _a.uid) && !('model' in panel.libraryPanel)) {
            // this will call init with a loaded library panel if it loads succesfully
            dispatch(loadLibraryPanelAndUpdate(panel));
            return;
        }
        let pluginToLoad = panel.type;
        let plugin = getStore().plugins.panels[pluginToLoad];
        if (!plugin) {
            try {
                plugin = yield dispatch(loadPanelPlugin(pluginToLoad));
            }
            catch (e) {
                // When plugin not found
                plugin = getPanelPluginNotFound(pluginToLoad, pluginToLoad === 'row');
            }
        }
        if (!panel.plugin) {
            yield panel.pluginLoaded(plugin);
        }
        dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
    });
}
export function cleanUpPanelState(panelKey) {
    return (dispatch) => {
        dispatch(removePanel({ key: panelKey }));
    };
}
export function changePanelPlugin({ panel, pluginId, options, fieldConfig, transformations, }) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        // ignore action is no change
        if (panel.type === pluginId && !options && !fieldConfig && !transformations) {
            return;
        }
        const store = getStore();
        let plugin = store.plugins.panels[pluginId];
        if (!plugin) {
            plugin = yield dispatch(loadPanelPlugin(pluginId));
        }
        if (panel.type !== pluginId) {
            panel.changePlugin(plugin);
        }
        if (options || fieldConfig || transformations) {
            const newOptions = getPanelOptionsWithDefaults({
                plugin,
                currentOptions: options || panel.options,
                currentFieldConfig: fieldConfig || panel.fieldConfig,
                isAfterPluginChange: false,
            });
            panel.options = newOptions.options;
            panel.fieldConfig = newOptions.fieldConfig;
            panel.transformations = transformations || panel.transformations;
            panel.configRev++;
        }
        panel.generateNewKey();
        dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
    });
}
export function changeToLibraryPanel(panel, libraryPanel) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const newPluginId = libraryPanel.model.type;
        const oldType = panel.type;
        // Update model but preserve gridPos & id
        panel.restoreModel(Object.assign(Object.assign({}, libraryPanel.model), { gridPos: panel.gridPos, id: panel.id, libraryPanel: libraryPanel }));
        // a new library panel usually means new queries, clear any current result
        panel.getQueryRunner().clearLastResult();
        // Handle plugin change
        if (oldType !== newPluginId) {
            const store = getStore();
            let plugin = store.plugins.panels[newPluginId];
            if (!plugin) {
                plugin = yield dispatch(loadPanelPlugin(newPluginId));
            }
            yield panel.pluginLoaded(plugin);
            panel.generateNewKey();
            yield dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
        }
        else {
            // Even if the plugin is the same, we want to change the key
            // to force a rerender
            const oldKey = panel.key;
            panel.generateNewKey();
            dispatch(changePanelKey({ oldKey, newKey: panel.key }));
        }
        panel.configRev = 0;
        panel.hasSavedPanelEditChange = true;
        panel.refresh();
        panel.events.publish(PanelQueriesChangedEvent);
        panel.events.publish(PanelOptionsChangedEvent);
    });
}
export function loadLibraryPanelAndUpdate(panel) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const uid = panel.libraryPanel.uid;
        try {
            const libPanel = yield getLibraryPanel(uid, true);
            panel.initLibraryPanel(libPanel);
            yield dispatch(initPanelState(panel));
            const dashboard = getStore().dashboard.getModel();
            if (panel.repeat && dashboard) {
                const panelIndex = dashboard.panels.findIndex((p) => p.id === panel.id);
                dashboard.repeatPanel(panel, panelIndex);
                dashboard.sortPanelsByGridPos();
                dashboard.events.publish(new DashboardPanelsChangedEvent());
            }
        }
        catch (ex) {
            console.log('ERROR: ', ex);
            dispatch(panelModelAndPluginReady({
                key: panel.key,
                plugin: getPanelPluginNotFound('Unable to load library panel: ' + uid, false),
            }));
        }
    });
}
//# sourceMappingURL=actions.js.map