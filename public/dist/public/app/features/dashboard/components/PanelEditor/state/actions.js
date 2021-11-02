import { __assign, __awaiter, __generator, __values } from "tslib";
import { closeEditor, PANEL_EDITOR_UI_STATE_STORAGE_KEY, setDiscardChanges, setPanelEditorUIState, updateEditorInitState, } from './reducers';
import { cleanUpPanelState, panelModelAndPluginReady } from 'app/features/panel/state/reducers';
import store from 'app/core/store';
import { pick } from 'lodash';
import { initPanelState } from 'app/features/panel/state/actions';
export function initPanelEditor(sourcePanel, dashboard) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var panel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    panel = dashboard.initEditPanel(sourcePanel);
                    return [4 /*yield*/, dispatch(initPanelState(panel))];
                case 1:
                    _a.sent();
                    dispatch(updateEditorInitState({
                        panel: panel,
                        sourcePanel: sourcePanel,
                    }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function discardPanelChanges() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var getPanel;
        return __generator(this, function (_a) {
            getPanel = getStore().panelEditor.getPanel;
            getPanel().configRev = 0;
            dispatch(setDiscardChanges(true));
            return [2 /*return*/];
        });
    }); };
}
export function updateDuplicateLibraryPanels(modifiedPanel, dashboard) {
    return function (dispatch) {
        var e_1, _a;
        var _b, _c, _d;
        if (((_b = modifiedPanel.libraryPanel) === null || _b === void 0 ? void 0 : _b.uid) === undefined || !dashboard) {
            return;
        }
        var modifiedSaveModel = modifiedPanel.getSaveModel();
        var _loop_1 = function (panel) {
            if (skipPanelUpdate(modifiedPanel, panel)) {
                return "continue";
            }
            panel.restoreModel(__assign(__assign({}, modifiedSaveModel), pick(panel, 'gridPos', 'id')));
            // Loaded plugin is not included in the persisted properties
            // So is not handled by restoreModel
            var pluginChanged = ((_c = panel.plugin) === null || _c === void 0 ? void 0 : _c.meta.id) !== ((_d = modifiedPanel.plugin) === null || _d === void 0 ? void 0 : _d.meta.id);
            panel.plugin = modifiedPanel.plugin;
            panel.configRev++;
            if (pluginChanged) {
                panel.generateNewKey();
                dispatch(panelModelAndPluginReady({ key: panel.key, plugin: panel.plugin }));
            }
            // Resend last query result on source panel query runner
            // But do this after the panel edit editor exit process has completed
            setTimeout(function () {
                panel.getQueryRunner().useLastResultFrom(modifiedPanel.getQueryRunner());
            }, 20);
        };
        try {
            for (var _e = __values(dashboard.panels), _f = _e.next(); !_f.done; _f = _e.next()) {
                var panel = _f.value;
                _loop_1(panel);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (modifiedPanel.repeat) {
            // We skip any repeated library panels so we need to update them by calling processRepeats
            // But do this after the panel edit editor exit process has completed
            setTimeout(function () { return dashboard.processRepeats(); }, 20);
        }
    };
}
export function skipPanelUpdate(modifiedPanel, panelToUpdate) {
    var _a;
    // don't update library panels that aren't of the same type
    if (((_a = panelToUpdate.libraryPanel) === null || _a === void 0 ? void 0 : _a.uid) !== modifiedPanel.libraryPanel.uid) {
        return true;
    }
    // don't update the modifiedPanel twice
    if (panelToUpdate.id && panelToUpdate.id === modifiedPanel.id) {
        return true;
    }
    // don't update library panels that are repeated
    if (panelToUpdate.repeatPanelId) {
        return true;
    }
    return false;
}
export function exitPanelEditor() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, _a, getPanel, getSourcePanel, shouldDiscardChanges, panel, modifiedSaveModel, sourcePanel_1, panelTypeChanged;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    dashboard = getStore().dashboard.getModel();
                    _a = getStore().panelEditor, getPanel = _a.getPanel, getSourcePanel = _a.getSourcePanel, shouldDiscardChanges = _a.shouldDiscardChanges;
                    panel = getPanel();
                    if (dashboard) {
                        dashboard.exitPanelEditor();
                    }
                    if (!!shouldDiscardChanges) return [3 /*break*/, 3];
                    modifiedSaveModel = panel.getSaveModel();
                    sourcePanel_1 = getSourcePanel();
                    panelTypeChanged = sourcePanel_1.type !== panel.type;
                    dispatch(updateDuplicateLibraryPanels(panel, dashboard));
                    sourcePanel_1.restoreModel(modifiedSaveModel);
                    sourcePanel_1.configRev++; // force check the configs
                    if (!panelTypeChanged) return [3 /*break*/, 2];
                    // Loaded plugin is not included in the persisted properties so is not handled by restoreModel
                    sourcePanel_1.plugin = panel.plugin;
                    sourcePanel_1.generateNewKey();
                    return [4 /*yield*/, dispatch(panelModelAndPluginReady({ key: sourcePanel_1.key, plugin: panel.plugin }))];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2:
                    // Resend last query result on source panel query runner
                    // But do this after the panel edit editor exit process has completed
                    setTimeout(function () {
                        sourcePanel_1.getQueryRunner().useLastResultFrom(panel.getQueryRunner());
                        sourcePanel_1.render();
                    }, 20);
                    _b.label = 3;
                case 3:
                    dispatch(cleanUpPanelState({ key: panel.key }));
                    dispatch(closeEditor());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updatePanelEditorUIState(uiState) {
    return function (dispatch, getStore) {
        var nextState = __assign(__assign({}, getStore().panelEditor.ui), uiState);
        dispatch(setPanelEditorUIState(nextState));
        try {
            store.setObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, nextState);
        }
        catch (error) {
            console.error(error);
        }
    };
}
//# sourceMappingURL=actions.js.map