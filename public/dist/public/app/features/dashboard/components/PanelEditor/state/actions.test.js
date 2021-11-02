import { __assign, __awaiter, __generator } from "tslib";
import { thunkTester } from '../../../../../../test/core/thunk/thunkTester';
import { closeEditor, initialState } from './reducers';
import { exitPanelEditor, initPanelEditor, skipPanelUpdate } from './actions';
import { cleanUpPanelState, panelModelAndPluginReady } from 'app/features/panel/state/reducers';
import { DashboardModel, PanelModel } from '../../../state';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
describe('panelEditor actions', function () {
    describe('initPanelEditor', function () {
        it('initPanelEditor should create edit panel model as clone', function () { return __awaiter(void 0, void 0, void 0, function () {
            var dashboard, sourcePanel, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dashboard = new DashboardModel({
                            panels: [{ id: 12, type: 'graph' }],
                        });
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        return [4 /*yield*/, thunkTester({
                                panelEditor: __assign({}, initialState),
                                plugins: {
                                    panels: {},
                                },
                            })
                                .givenThunk(initPanelEditor)
                                .whenThunkIsDispatched(sourcePanel, dashboard)];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions.length).toBe(2);
                        expect(dispatchedActions[0].type).toBe(panelModelAndPluginReady.type);
                        expect(dispatchedActions[1].payload.sourcePanel).toBe(sourcePanel);
                        expect(dispatchedActions[1].payload.panel).not.toBe(sourcePanel);
                        expect(dispatchedActions[1].payload.panel.id).toBe(sourcePanel.id);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('panelEditorCleanUp', function () {
        it('should update source panel', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sourcePanel, dashboard, panel, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        dashboard = new DashboardModel({
                            panels: [{ id: 12, type: 'graph' }],
                        });
                        panel = dashboard.initEditPanel(sourcePanel);
                        panel.updateOptions({ prop: true });
                        state = __assign(__assign({}, initialState()), { getPanel: function () { return panel; }, getSourcePanel: function () { return sourcePanel; } });
                        return [4 /*yield*/, thunkTester({
                                panelEditor: state,
                                dashboard: {
                                    getModel: function () { return dashboard; },
                                },
                            })
                                .givenThunk(exitPanelEditor)
                                .whenThunkIsDispatched()];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions.length).toBe(2);
                        expect(dispatchedActions[0].type).toBe(cleanUpPanelState.type);
                        expect(dispatchedActions[1].type).toBe(closeEditor.type);
                        expect(sourcePanel.getOptions()).toEqual({ prop: true });
                        expect(sourcePanel.id).toEqual(12);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should dispatch panelModelAndPluginReady if type changed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sourcePanel, dashboard, panel, state, panelDestroy, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        dashboard = new DashboardModel({
                            panels: [{ id: 12, type: 'graph' }],
                        });
                        panel = dashboard.initEditPanel(sourcePanel);
                        panel.type = 'table';
                        panel.plugin = getPanelPlugin({ id: 'table' });
                        panel.updateOptions({ prop: true });
                        state = __assign(__assign({}, initialState()), { getPanel: function () { return panel; }, getSourcePanel: function () { return sourcePanel; } });
                        panelDestroy = (panel.destroy = jest.fn());
                        return [4 /*yield*/, thunkTester({
                                panelEditor: state,
                                dashboard: {
                                    getModel: function () { return dashboard; },
                                },
                            })
                                .givenThunk(exitPanelEditor)
                                .whenThunkIsDispatched()];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions.length).toBe(3);
                        expect(dispatchedActions[0].type).toBe(panelModelAndPluginReady.type);
                        expect(sourcePanel.plugin).toEqual(panel.plugin);
                        expect(panelDestroy.mock.calls.length).toEqual(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should discard changes when shouldDiscardChanges is true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sourcePanel, dashboard, panel, state, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        sourcePanel.plugin = {
                            customFieldConfigs: {},
                        };
                        dashboard = new DashboardModel({
                            panels: [{ id: 12, type: 'graph' }],
                        });
                        panel = dashboard.initEditPanel(sourcePanel);
                        panel.updateOptions({ prop: true });
                        state = __assign(__assign({}, initialState()), { shouldDiscardChanges: true, getPanel: function () { return panel; }, getSourcePanel: function () { return sourcePanel; } });
                        return [4 /*yield*/, thunkTester({
                                panelEditor: state,
                                dashboard: {
                                    getModel: function () { return dashboard; },
                                },
                            })
                                .givenThunk(exitPanelEditor)
                                .whenThunkIsDispatched()];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions.length).toBe(2);
                        expect(sourcePanel.getOptions()).toEqual({});
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('skipPanelUpdate', function () {
        describe('when called with panel with an library uid different from the modified panel', function () {
            it('then it should return true', function () {
                var meta = {};
                var modified = { libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                var panel = { libraryPanel: { uid: '456', name: 'Name', meta: meta, version: 1 } };
                expect(skipPanelUpdate(modified, panel)).toEqual(true);
            });
        });
        describe('when called with a panel that is the same as the modified panel', function () {
            it('then it should return true', function () {
                var meta = {};
                var modified = { id: 14, libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                var panel = { id: 14, libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                expect(skipPanelUpdate(modified, panel)).toEqual(true);
            });
        });
        describe('when called with a panel that is repeated', function () {
            it('then it should return true', function () {
                var meta = {};
                var modified = { libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                var panel = { repeatPanelId: 14, libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                expect(skipPanelUpdate(modified, panel)).toEqual(true);
            });
        });
        describe('when called with a panel that is a duplicate of the modified panel', function () {
            it('then it should return false', function () {
                var meta = {};
                var modified = { libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                var panel = { libraryPanel: { uid: '123', name: 'Name', meta: meta, version: 1 } };
                expect(skipPanelUpdate(modified, panel)).toEqual(false);
            });
        });
    });
});
//# sourceMappingURL=actions.test.js.map