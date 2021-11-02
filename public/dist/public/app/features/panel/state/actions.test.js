import { __awaiter, __generator } from "tslib";
import { PanelModel } from 'app/features/dashboard/state';
import { thunkTester } from '../../../../test/core/thunk/thunkTester';
import { changePanelPlugin } from './actions';
import { panelModelAndPluginReady } from './reducers';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';
import { panelPluginLoaded } from 'app/features/plugins/admin/state/actions';
import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { mockStandardFieldConfigOptions } from 'test/helpers/fieldConfig';
jest.mock('app/features/plugins/importPanelPlugin', function () {
    return {
        importPanelPlugin: function () {
            return Promise.resolve(getPanelPlugin({
                id: 'table',
            }).useFieldConfig());
        },
    };
});
standardFieldConfigEditorRegistry.setInit(function () { return mockStandardFieldConfigOptions(); });
standardEditorsRegistry.setInit(function () { return mockStandardFieldConfigOptions(); });
describe('panel state actions', function () {
    describe('changePanelPlugin', function () {
        it('Should load plugin and call changePlugin', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sourcePanel, dispatchedActions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        return [4 /*yield*/, thunkTester({
                                plugins: {
                                    panels: {},
                                },
                                panels: {},
                            })
                                .givenThunk(changePanelPlugin)
                                .whenThunkIsDispatched({
                                panel: sourcePanel,
                                pluginId: 'table',
                            })];
                    case 1:
                        dispatchedActions = _a.sent();
                        expect(dispatchedActions.length).toBe(2);
                        expect(dispatchedActions[0].type).toBe(panelPluginLoaded.type);
                        expect(dispatchedActions[1].type).toBe(panelModelAndPluginReady.type);
                        expect(sourcePanel.type).toBe('table');
                        return [2 /*return*/];
                }
            });
        }); });
        it('Should apply options and fieldConfig', function () { return __awaiter(void 0, void 0, void 0, function () {
            var sourcePanel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sourcePanel = new PanelModel({ id: 12, type: 'graph' });
                        return [4 /*yield*/, thunkTester({
                                plugins: {
                                    panels: {},
                                },
                                panels: {},
                            })
                                .givenThunk(changePanelPlugin)
                                .whenThunkIsDispatched({
                                panel: sourcePanel,
                                pluginId: 'table',
                                options: {
                                    showHeader: true,
                                },
                                fieldConfig: {
                                    defaults: {
                                        unit: 'short',
                                    },
                                    overrides: [],
                                },
                            })];
                    case 1:
                        _a.sent();
                        expect(sourcePanel.options.showHeader).toBe(true);
                        expect(sourcePanel.fieldConfig.defaults.unit).toBe('short');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map