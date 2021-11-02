import { __assign, __awaiter, __generator, __read } from "tslib";
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { VariableHide, VariableRefresh, VariableSort } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, toVariablePayload } from '../state/types';
import { addVariable, changeVariableProp, setCurrentVariableValue, variableStateCompleted, variableStateFailed, variableStateFetching, } from '../state/sharedReducer';
import { changeQueryVariableDataSource, changeQueryVariableQuery, flattenQuery, hasSelfReferencingQuery, initQueryVariableEditor, updateQueryVariableOptions, } from './actions';
import { updateVariableOptions } from './reducer';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError, setIdInEditor, } from '../editor/reducer';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { expect } from 'test/lib/common';
import { updateOptions } from '../state/actions';
import { notifyApp } from '../../../core/reducers/appNotification';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { getTimeSrv, setTimeSrv } from '../../dashboard/services/TimeSrv';
import { setVariableQueryRunner, VariableQueryRunner } from './VariableQueryRunner';
import { setDataSourceSrv } from '@grafana/runtime';
var mocks = {
    datasource: {
        metricFindQuery: jest.fn().mockResolvedValue([]),
    },
    dataSourceSrv: {
        get: function (name) { return Promise.resolve(mocks[name]); },
        getList: jest.fn().mockReturnValue([]),
    },
    pluginLoader: {
        importDataSourcePlugin: jest.fn().mockResolvedValue({ components: {} }),
    },
};
setDataSourceSrv(mocks.dataSourceSrv);
jest.mock('../../plugins/plugin_loader', function () { return ({
    importDataSourcePlugin: function () { return mocks.pluginLoader.importDataSourcePlugin(); },
}); });
jest.mock('../../templating/template_srv', function () { return ({
    replace: jest.fn().mockReturnValue(''),
}); });
describe('query actions', function () {
    var originalTimeSrv;
    beforeEach(function () {
        originalTimeSrv = getTimeSrv();
        setTimeSrv({
            timeRange: jest.fn().mockReturnValue(getDefaultTimeRange()),
        });
        setVariableQueryRunner(new VariableQueryRunner());
    });
    afterEach(function () {
        setTimeSrv(originalTimeSrv);
    });
    variableAdapters.setInit(function () { return [createQueryVariableAdapter()]; });
    describe('when updateQueryVariableOptions is dispatched for variable without both tags and includeAll', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, optionsMetrics, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: false });
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        mockDatasourceMetrics(variable, optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(updateQueryVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption('A');
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsShouldEqual(updateVariableOptions(toVariablePayload(variable, update)), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateQueryVariableOptions is dispatched for variable with includeAll but without tags', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, optionsMetrics, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        mockDatasourceMetrics(variable, optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(updateQueryVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption(ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE);
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), updateOptions = _a[0], setCurrentAction = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(updateOptions).toEqual(updateVariableOptions(toVariablePayload(variable, update)));
                            expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateQueryVariableOptions is dispatched for variable open in editor', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, optionsMetrics, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        mockDatasourceMetrics(variable, optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
                                .whenAsyncActionIsDispatched(updateQueryVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption(ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE);
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 3), clearErrors = _a[0], updateOptions = _a[1], setCurrentAction = _a[2];
                            var expectedNumberOfActions = 3;
                            expect(clearErrors).toEqual(removeVariableEditorError({ errorProp: 'update' }));
                            expect(updateOptions).toEqual(updateVariableOptions(toVariablePayload(variable, update)));
                            expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateQueryVariableOptions is dispatched for variable with searchFilter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, optionsMetrics, tester, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        mockDatasourceMetrics(variable, optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
                                .whenAsyncActionIsDispatched(updateQueryVariableOptions(toVariablePayload(variable), 'search'), true)];
                    case 1:
                        tester = _a.sent();
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), clearErrors = _a[0], updateOptions = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(clearErrors).toEqual(removeVariableEditorError({ errorProp: 'update' }));
                            expect(updateOptions).toEqual(updateVariableOptions(toVariablePayload(variable, update)));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when updateQueryVariableOptions is dispatched and fails for variable open in editor', function () {
        silenceConsoleOutput();
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, error, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        error = { message: 'failed to fetch metrics' };
                        mocks[variable.datasource].metricFindQuery = jest.fn(function () { return Promise.reject(error); });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
                                .whenAsyncActionIsDispatched(updateOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                            var expectedNumberOfActions = 5;
                            expect(dispatchedActions[0]).toEqual(variableStateFetching(toVariablePayload(variable)));
                            expect(dispatchedActions[1]).toEqual(removeVariableEditorError({ errorProp: 'update' }));
                            expect(dispatchedActions[2]).toEqual(addVariableEditorError({ errorProp: 'update', errorText: error.message }));
                            expect(dispatchedActions[3]).toEqual(variableStateFailed(toVariablePayload(variable, { error: { message: 'failed to fetch metrics' } })));
                            expect(dispatchedActions[4].type).toEqual(notifyApp.type);
                            expect(dispatchedActions[4].payload.title).toEqual('Templating [0]');
                            expect(dispatchedActions[4].payload.text).toEqual('Error updating options: failed to fetch metrics');
                            expect(dispatchedActions[4].payload.severity).toEqual('error');
                            return dispatchedActions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initQueryVariableEditor is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, testMetricSource, editor, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        testMetricSource = { name: 'test', value: 'test', meta: {} };
                        editor = {};
                        mocks.dataSourceSrv.getList = jest.fn().mockReturnValue([testMetricSource]);
                        mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                            components: { VariableQueryEditor: editor },
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(initQueryVariableEditor(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), setDatasource = _a[0], setEditor = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(setDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks['datasource'] }));
                            expect(setEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initQueryVariableEditor is dispatched and metricsource without value is available', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, testMetricSource, editor, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        testMetricSource = { name: 'test', value: null, meta: {} };
                        editor = {};
                        mocks.dataSourceSrv.getList = jest.fn().mockReturnValue([testMetricSource]);
                        mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                            components: { VariableQueryEditor: editor },
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(initQueryVariableEditor(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), setDatasource = _a[0], setEditor = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(setDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks['datasource'] }));
                            expect(setEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initQueryVariableEditor is dispatched and no metric sources was found', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, editor, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ includeAll: true });
                        editor = {};
                        mocks.dataSourceSrv.getList = jest.fn().mockReturnValue([]);
                        mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                            components: { VariableQueryEditor: editor },
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(initQueryVariableEditor(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), setDatasource = _a[0], setEditor = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(setDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks['datasource'] }));
                            expect(setEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initQueryVariableEditor is dispatched and variable dont have datasource', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ datasource: undefined });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(initQueryVariableEditor(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 1), setDatasource = _a[0];
                            var expectedNumberOfActions = 1;
                            expect(setDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: undefined }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeQueryVariableDataSource is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, editor, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ datasource: 'other' });
                        editor = {};
                        mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                            components: { VariableQueryEditor: editor },
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableDataSource(toVariablePayload(variable), 'datasource'), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), updateDatasource = _a[0], updateEditor = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(updateDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks.datasource }));
                            expect(updateEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and data source type changed', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var variable, editor, preloadedState, tester;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            variable = createVariable({ datasource: 'other' });
                            editor = {};
                            preloadedState = { templating: { editor: { extended: { dataSource: { type: 'previous' } } } } };
                            mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                                components: { VariableQueryEditor: editor },
                            });
                            return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                    .givenRootReducer(getRootReducer())
                                    .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                    .whenAsyncActionIsDispatched(changeQueryVariableDataSource(toVariablePayload(variable), 'datasource'), true)];
                        case 1:
                            tester = _a.sent();
                            tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                                var _a = __read(actions, 3), changeVariable = _a[0], updateDatasource = _a[1], updateEditor = _a[2];
                                var expectedNumberOfActions = 3;
                                expect(changeVariable).toEqual(changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: '' })));
                                expect(updateDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks.datasource }));
                                expect(updateEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                                return actions.length === expectedNumberOfActions;
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when changeQueryVariableDataSource is dispatched and editor is not configured', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, editor, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ datasource: 'other' });
                        editor = LegacyVariableQueryEditor;
                        mocks.pluginLoader.importDataSourcePlugin = jest.fn().mockResolvedValue({
                            components: {},
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableDataSource(toVariablePayload(variable), 'datasource'), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 2), updateDatasource = _a[0], updateEditor = _a[1];
                            var expectedNumberOfActions = 2;
                            expect(updateDatasource).toEqual(changeVariableEditorExtended({ propName: 'dataSource', propValue: mocks.datasource }));
                            expect(updateEditor).toEqual(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: editor }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeQueryVariableQuery is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var optionsMetrics, variable, query, definition, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        variable = createVariable({ datasource: 'datasource', includeAll: true });
                        query = '$datasource';
                        definition = 'depends on datasource variable';
                        mockDatasourceMetrics(__assign(__assign({}, variable), { query: query }), optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableQuery(toVariablePayload(variable), query, definition), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption(ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE);
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsShouldEqual(removeVariableEditorError({ errorProp: 'query' }), changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: query })), changeVariableProp(toVariablePayload(variable, { propName: 'definition', propValue: definition })), variableStateFetching(toVariablePayload(variable)), updateVariableOptions(toVariablePayload(variable, update)), setCurrentVariableValue(toVariablePayload(variable, { option: option })), variableStateCompleted(toVariablePayload(variable)));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeQueryVariableQuery is dispatched for variable without tags', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var optionsMetrics, variable, query, definition, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        variable = createVariable({ datasource: 'datasource', includeAll: true });
                        query = '$datasource';
                        definition = 'depends on datasource variable';
                        mockDatasourceMetrics(__assign(__assign({}, variable), { query: query }), optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableQuery(toVariablePayload(variable), query, definition), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption(ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE);
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsShouldEqual(removeVariableEditorError({ errorProp: 'query' }), changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: query })), changeVariableProp(toVariablePayload(variable, { propName: 'definition', propValue: definition })), variableStateFetching(toVariablePayload(variable)), updateVariableOptions(toVariablePayload(variable, update)), setCurrentVariableValue(toVariablePayload(variable, { option: option })), variableStateCompleted(toVariablePayload(variable)));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeQueryVariableQuery is dispatched for variable without tags and all', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var optionsMetrics, variable, query, definition, tester, option, update;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        optionsMetrics = [createMetric('A'), createMetric('B')];
                        variable = createVariable({ datasource: 'datasource', includeAll: false });
                        query = '$datasource';
                        definition = 'depends on datasource variable';
                        mockDatasourceMetrics(__assign(__assign({}, variable), { query: query }), optionsMetrics);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableQuery(toVariablePayload(variable), query, definition), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption('A');
                        update = { results: optionsMetrics, templatedRegex: '' };
                        tester.thenDispatchedActionsShouldEqual(removeVariableEditorError({ errorProp: 'query' }), changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: query })), changeVariableProp(toVariablePayload(variable, { propName: 'definition', propValue: definition })), variableStateFetching(toVariablePayload(variable)), updateVariableOptions(toVariablePayload(variable, update)), setCurrentVariableValue(toVariablePayload(variable, { option: option })), variableStateCompleted(toVariablePayload(variable)));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeQueryVariableQuery is dispatched with invalid query', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, query, definition, tester, errorText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createVariable({ datasource: 'datasource', includeAll: false });
                        query = "$" + variable.name;
                        definition = 'depends on datasource variable';
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(changeQueryVariableQuery(toVariablePayload(variable), query, definition), true)];
                    case 1:
                        tester = _a.sent();
                        errorText = 'Query cannot contain a reference to itself. Variable: $' + variable.name;
                        tester.thenDispatchedActionsPredicateShouldEqual(function (actions) {
                            var _a = __read(actions, 1), editorError = _a[0];
                            var expectedNumberOfActions = 1;
                            expect(editorError).toEqual(addVariableEditorError({ errorProp: 'query', errorText: errorText }));
                            return actions.length === expectedNumberOfActions;
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('hasSelfReferencingQuery', function () {
        it('when called with a string', function () {
            var query = '$query';
            var name = 'query';
            expect(hasSelfReferencingQuery(name, query)).toBe(true);
        });
        it('when called with an array', function () {
            var query = ['$query'];
            var name = 'query';
            expect(hasSelfReferencingQuery(name, query)).toBe(true);
        });
        it('when called with a simple object', function () {
            var query = { a: '$query' };
            var name = 'query';
            expect(hasSelfReferencingQuery(name, query)).toBe(true);
        });
        it('when called with a complex object', function () {
            var query = {
                level2: {
                    level3: {
                        query: 'query3',
                        refId: 'C',
                        num: 2,
                        bool: true,
                        arr: [
                            { query: 'query4', refId: 'D', num: 4, bool: true },
                            {
                                query: 'query5',
                                refId: 'E',
                                num: 5,
                                bool: true,
                                arr: [{ query: '$query', refId: 'F', num: 6, bool: true }],
                            },
                        ],
                    },
                    query: 'query2',
                    refId: 'B',
                    num: 1,
                    bool: false,
                },
                query: 'query1',
                refId: 'A',
                num: 0,
                bool: true,
                arr: [
                    { query: 'query7', refId: 'G', num: 7, bool: true },
                    {
                        query: 'query8',
                        refId: 'H',
                        num: 8,
                        bool: true,
                        arr: [{ query: 'query9', refId: 'I', num: 9, bool: true }],
                    },
                ],
            };
            var name = 'query';
            expect(hasSelfReferencingQuery(name, query)).toBe(true);
        });
        it('when called with a number', function () {
            var query = 1;
            var name = 'query';
            expect(hasSelfReferencingQuery(name, query)).toBe(false);
        });
    });
    describe('flattenQuery', function () {
        it('when called with a complex object', function () {
            var query = {
                level2: {
                    level3: {
                        query: '${query3}',
                        refId: 'C',
                        num: 2,
                        bool: true,
                        arr: [
                            { query: '${query4}', refId: 'D', num: 4, bool: true },
                            {
                                query: '${query5}',
                                refId: 'E',
                                num: 5,
                                bool: true,
                                arr: [{ query: '${query6}', refId: 'F', num: 6, bool: true }],
                            },
                        ],
                    },
                    query: '${query2}',
                    refId: 'B',
                    num: 1,
                    bool: false,
                },
                query: '${query1}',
                refId: 'A',
                num: 0,
                bool: true,
                arr: [
                    { query: '${query7}', refId: 'G', num: 7, bool: true },
                    {
                        query: '${query8}',
                        refId: 'H',
                        num: 8,
                        bool: true,
                        arr: [{ query: '${query9}', refId: 'I', num: 9, bool: true }],
                    },
                ],
            };
            expect(flattenQuery(query)).toEqual({
                query: '${query1}',
                refId: 'A',
                num: 0,
                bool: true,
                level2_query: '${query2}',
                level2_refId: 'B',
                level2_num: 1,
                level2_bool: false,
                level2_level3_query: '${query3}',
                level2_level3_refId: 'C',
                level2_level3_num: 2,
                level2_level3_bool: true,
                level2_level3_arr_0_query: '${query4}',
                level2_level3_arr_0_refId: 'D',
                level2_level3_arr_0_num: 4,
                level2_level3_arr_0_bool: true,
                level2_level3_arr_1_query: '${query5}',
                level2_level3_arr_1_refId: 'E',
                level2_level3_arr_1_num: 5,
                level2_level3_arr_1_bool: true,
                level2_level3_arr_1_arr_0_query: '${query6}',
                level2_level3_arr_1_arr_0_refId: 'F',
                level2_level3_arr_1_arr_0_num: 6,
                level2_level3_arr_1_arr_0_bool: true,
                arr_0_query: '${query7}',
                arr_0_refId: 'G',
                arr_0_num: 7,
                arr_0_bool: true,
                arr_1_query: '${query8}',
                arr_1_refId: 'H',
                arr_1_num: 8,
                arr_1_bool: true,
                arr_1_arr_0_query: '${query9}',
                arr_1_arr_0_refId: 'I',
                arr_1_arr_0_num: 9,
                arr_1_arr_0_bool: true,
            });
        });
    });
});
function mockDatasourceMetrics(variable, optionsMetrics) {
    var _a;
    var metrics = (_a = {},
        _a[variable.query] = optionsMetrics,
        _a);
    var metricFindQuery = mocks[variable.datasource].metricFindQuery;
    metricFindQuery.mockReset();
    metricFindQuery.mockImplementation(function (query) { var _a; return Promise.resolve((_a = metrics[query]) !== null && _a !== void 0 ? _a : []); });
}
function createVariable(extend) {
    return __assign({ type: 'query', id: '0', global: false, current: createOption(''), options: [], query: 'options-query', name: 'Constant', label: '', hide: VariableHide.dontHide, skipUrlSync: false, index: 0, datasource: 'datasource', definition: '', sort: VariableSort.alphabeticalAsc, refresh: VariableRefresh.onDashboardLoad, regex: '', multi: true, includeAll: true, state: LoadingState.NotStarted, error: null, description: null }, (extend !== null && extend !== void 0 ? extend : {}));
}
function createOption(text, value) {
    var metric = createMetric(text);
    return __assign(__assign({}, metric), { value: value !== null && value !== void 0 ? value : metric.text, selected: false });
}
function createMetric(value) {
    return {
        text: value,
    };
}
//# sourceMappingURL=actions.test.js.map