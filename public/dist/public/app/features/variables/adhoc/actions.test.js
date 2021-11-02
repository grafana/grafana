import { __assign, __awaiter, __generator } from "tslib";
import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { addFilter, applyFilterFromTable, changeFilter, changeVariableDatasource, initAdHocVariableEditor, removeFilter, setFiltersFromUrl, } from './actions';
import { filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { changeVariableEditorExtended, setIdInEditor } from '../editor/reducer';
import { adHocBuilder } from '../shared/testing/builders';
import { locationService } from '@grafana/runtime';
var getMetricSources = jest.fn().mockReturnValue([]);
var getDatasource = jest.fn().mockResolvedValue({});
locationService.partial = jest.fn();
jest.mock('app/features/plugins/datasource_srv', function () { return ({
    getDatasourceSrv: jest.fn(function () { return ({
        get: getDatasource,
        getMetricSources: getMetricSources,
    }); }),
}); });
variableAdapters.setInit(function () { return [createAdHocVariableAdapter()]; });
describe('adhoc actions', function () {
    describe('when applyFilterFromTable is dispatched and filter already exist', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, existingFilter, variable, tester, expectedQuery, expectedFilter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            datasource: { uid: 'influxdb' },
                            key: 'filter-key',
                            value: 'filter-value',
                            operator: '=',
                        };
                        existingFilter = {
                            key: 'filter-key',
                            value: 'filter-existing',
                            operator: '!=',
                            condition: '',
                        };
                        variable = adHocBuilder()
                            .withId('Filters')
                            .withName('Filters')
                            .withFilters([existingFilter])
                            .withDatasource(options.datasource)
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(applyFilterFromTable(options), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-Filters': ['filter-key|!=|filter-existing', 'filter-key|=|filter-value'] };
                        expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
                        tester.thenDispatchedActionsShouldEqual(filterAdded(toVariablePayload(variable, expectedFilter)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when applyFilterFromTable is dispatched and previously no variable or filter exists', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, tester, variable, expectedQuery, expectedFilter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            datasource: { uid: 'influxdb' },
                            key: 'filter-key',
                            value: 'filter-value',
                            operator: '=',
                        };
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(applyFilterFromTable(options), true)];
                    case 1:
                        tester = _a.sent();
                        variable = adHocBuilder().withId('Filters').withName('Filters').withDatasource(options.datasource).build();
                        expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };
                        expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
                        tester.thenDispatchedActionsShouldEqual(createAddVariableAction(variable), filterAdded(toVariablePayload(variable, expectedFilter)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when applyFilterFromTable is dispatched and previously no filter exists', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, tester, expectedFilter, expectedQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            datasource: { uid: 'influxdb' },
                            key: 'filter-key',
                            value: 'filter-value',
                            operator: '=',
                        };
                        variable = adHocBuilder()
                            .withId('Filters')
                            .withName('Filters')
                            .withFilters([])
                            .withDatasource(options.datasource)
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(applyFilterFromTable(options), true)];
                    case 1:
                        tester = _a.sent();
                        expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
                        expectedQuery = { 'var-Filters': ['filter-key|=|filter-value'] };
                        tester.thenDispatchedActionsShouldEqual(filterAdded(toVariablePayload(variable, expectedFilter)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when applyFilterFromTable is dispatched and adhoc variable with other datasource exists', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, existing, variable, tester, expectedFilter, expectedQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            datasource: { uid: 'influxdb' },
                            key: 'filter-key',
                            value: 'filter-value',
                            operator: '=',
                        };
                        existing = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        variable = adHocBuilder().withId('Filters').withName('Filters').withDatasource(options.datasource).build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(existing))
                                .whenAsyncActionIsDispatched(applyFilterFromTable(options), true)];
                    case 1:
                        tester = _a.sent();
                        expectedFilter = { key: 'filter-key', value: 'filter-value', operator: '=', condition: '' };
                        expectedQuery = { 'var-elastic-filter': [], 'var-Filters': ['filter-key|=|filter-value'] };
                        tester.thenDispatchedActionsShouldEqual(createAddVariableAction(variable, 1), filterAdded(toVariablePayload(variable, expectedFilter)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeFilter is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var existing, updated, variable, update, tester, expectedQuery, expectedUpdate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existing = {
                            key: 'key',
                            value: 'value',
                            operator: '=',
                            condition: '',
                        };
                        updated = __assign(__assign({}, existing), { operator: '!=' });
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([existing])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        update = { index: 0, filter: updated };
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(changeFilter('elastic-filter', update), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': ['key|!=|value'] };
                        expectedUpdate = { index: 0, filter: updated };
                        tester.thenDispatchedActionsShouldEqual(filterUpdated(toVariablePayload(variable, expectedUpdate)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when addFilter is dispatched on variable with existing filter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var existing, adding, variable, tester, expectedQuery, expectedFilter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existing = {
                            key: 'key',
                            value: 'value',
                            operator: '=',
                            condition: '',
                        };
                        adding = __assign(__assign({}, existing), { operator: '!=' });
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([existing])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(addFilter('elastic-filter', adding), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|!=|value'] };
                        expectedFilter = { key: 'key', value: 'value', operator: '!=', condition: '' };
                        tester.thenDispatchedActionsShouldEqual(filterAdded(toVariablePayload(variable, expectedFilter)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when addFilter is dispatched on variable with no existing filter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var adding, variable, tester, expectedQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adding = {
                            key: 'key',
                            value: 'value',
                            operator: '=',
                            condition: '',
                        };
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(addFilter('elastic-filter', adding), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': ['key|=|value'] };
                        tester.thenDispatchedActionsShouldEqual(filterAdded(toVariablePayload(variable, adding)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when removeFilter is dispatched on variable with no existing filter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, tester, expectedQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(removeFilter('elastic-filter', 0), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': [] };
                        tester.thenDispatchedActionsShouldEqual(filterRemoved(toVariablePayload(variable, 0)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when removeFilter is dispatched on variable with existing filter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var filter, variable, tester, expectedQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        filter = {
                            key: 'key',
                            value: 'value',
                            operator: '=',
                            condition: '',
                        };
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([filter])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(removeFilter('elastic-filter', 0), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': [] };
                        tester.thenDispatchedActionsShouldEqual(filterRemoved(toVariablePayload(variable, 0)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when setFiltersFromUrl is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var existing, variable, fromUrl, tester, expectedQuery, expectedFilters;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        existing = {
                            key: 'key',
                            value: 'value',
                            operator: '=',
                            condition: '',
                        };
                        variable = adHocBuilder()
                            .withId('elastic-filter')
                            .withName('elastic-filter')
                            .withFilters([existing])
                            .withDatasource({ uid: 'elasticsearch' })
                            .build();
                        fromUrl = [
                            __assign(__assign({}, existing), { condition: '>' }),
                            __assign(__assign({}, existing), { name: 'value-2' }),
                        ];
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenAsyncActionIsDispatched(setFiltersFromUrl('elastic-filter', fromUrl), true)];
                    case 1:
                        tester = _a.sent();
                        expectedQuery = { 'var-elastic-filter': ['key|=|value', 'key|=|value'] };
                        expectedFilters = [
                            { key: 'key', value: 'value', operator: '=', condition: '>' },
                            { key: 'key', value: 'value', operator: '=', condition: '', name: 'value-2' },
                        ];
                        tester.thenDispatchedActionsShouldEqual(filtersRestored(toVariablePayload(variable, expectedFilters)));
                        expect(locationService.partial).toHaveBeenLastCalledWith(expectedQuery);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when initAdHocVariableEditor is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasources, tester, expectedDatasources;
            return __generator(this, function (_a) {
                datasources = [
                    __assign(__assign({}, createDatasource('default', true)), { value: null }),
                    createDatasource('elasticsearch-v1'),
                    createDatasource('loki', false),
                    createDatasource('influx'),
                    createDatasource('google-sheets', false),
                    createDatasource('elasticsearch-v7'),
                ];
                getMetricSources.mockRestore();
                getMetricSources.mockReturnValue(datasources);
                tester = reduxTester()
                    .givenRootReducer(getRootReducer())
                    .whenActionIsDispatched(initAdHocVariableEditor());
                expectedDatasources = [
                    { text: '', value: '' },
                    { text: 'default (default)', value: null },
                    { text: 'elasticsearch-v1', value: 'elasticsearch-v1' },
                    { text: 'influx', value: 'influx' },
                    { text: 'elasticsearch-v7', value: 'elasticsearch-v7' },
                ];
                tester.thenDispatchedActionsShouldEqual(changeVariableEditorExtended({ propName: 'dataSources', propValue: expectedDatasources }));
                return [2 /*return*/];
            });
        }); });
    });
    describe('when changeVariableDatasource is dispatched with unsupported datasource', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, loadingText, variable, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = { uid: 'mysql' };
                        loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';
                        variable = adHocBuilder().withId('Filters').withName('Filters').withDatasource({ uid: 'influxdb' }).build();
                        getDatasource.mockRestore();
                        getDatasource.mockResolvedValue(null);
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
                                .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText }), changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })), changeVariableEditorExtended({
                            propName: 'infoText',
                            propValue: 'This data source does not support ad hoc filters yet.',
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when changeVariableDatasource is dispatched with datasource', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var datasource, loadingText, variable, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        datasource = { uid: 'elasticsearch' };
                        loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';
                        variable = adHocBuilder().withId('Filters').withName('Filters').withDatasource({ uid: 'influxdb' }).build();
                        getDatasource.mockRestore();
                        getDatasource.mockResolvedValue({
                            getTagKeys: function () { },
                        });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(createAddVariableAction(variable))
                                .whenActionIsDispatched(setIdInEditor({ id: variable.id }))
                                .whenAsyncActionIsDispatched(changeVariableDatasource(datasource), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(changeVariableEditorExtended({ propName: 'infoText', propValue: loadingText }), changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function createAddVariableAction(variable, index) {
    if (index === void 0) { index = 0; }
    var identifier = toVariableIdentifier(variable);
    var global = false;
    var data = { global: global, index: index, model: __assign(__assign({}, variable), { index: -1, global: global }) };
    return addVariable(toVariablePayload(identifier, data));
}
function createDatasource(name, selectable) {
    if (selectable === void 0) { selectable = true; }
    return {
        name: name,
        value: name,
        meta: {
            mixed: !selectable,
        },
    };
}
//# sourceMappingURL=actions.test.js.map