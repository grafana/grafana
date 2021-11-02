import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import { getTemplatingRootReducer } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { initDashboardTemplating, processVariable } from './actions';
import { setCurrentVariableValue, variableStateCompleted, variableStateFetching } from './sharedReducer';
import { toVariableIdentifier, toVariablePayload } from './types';
import { VariableRefresh } from '../types';
import { updateVariableOptions } from '../query/reducer';
import { customBuilder, queryBuilder } from '../shared/testing/builders';
import { variablesInitTransaction } from './transactionReducer';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import { setDataSourceSrv } from '@grafana/runtime';
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: jest.fn().mockReturnValue({
        timeRange: jest.fn().mockReturnValue({
            from: '2001-01-01T01:00:00.000Z',
            to: '2001-01-01T02:00:00.000Z',
            raw: {
                from: 'now-1h',
                to: 'now',
            },
        }),
    }),
}); });
setDataSourceSrv({
    get: jest.fn().mockResolvedValue({
        metricFindQuery: jest.fn().mockImplementation(function (query, options) {
            if (query === '$custom.*') {
                return Promise.resolve([
                    { value: 'AA', text: 'AA' },
                    { value: 'AB', text: 'AB' },
                    { value: 'AC', text: 'AC' },
                ]);
            }
            if (query === '$custom.$queryDependsOnCustom.*') {
                return Promise.resolve([
                    { value: 'AAA', text: 'AAA' },
                    { value: 'AAB', text: 'AAB' },
                    { value: 'AAC', text: 'AAC' },
                ]);
            }
            if (query === '*') {
                return Promise.resolve([
                    { value: 'A', text: 'A' },
                    { value: 'B', text: 'B' },
                    { value: 'C', text: 'C' },
                ]);
            }
            return Promise.resolve([]);
        }),
    }),
});
variableAdapters.setInit(function () { return [createCustomVariableAdapter(), createQueryVariableAdapter()]; });
describe('processVariable', function () {
    // these following processVariable tests will test the following base setup
    // custom doesn't depend on any other variable
    // queryDependsOnCustom depends on custom
    // queryNoDepends doesn't depend on any other variable
    var getAndSetupProcessVariableContext = function () {
        var custom = customBuilder()
            .withId('custom')
            .withName('custom')
            .withQuery('A,B,C')
            .withOptions('A', 'B', 'C')
            .withCurrent('A')
            .build();
        var queryDependsOnCustom = queryBuilder()
            .withId('queryDependsOnCustom')
            .withName('queryDependsOnCustom')
            .withQuery('$custom.*')
            .withOptions('AA', 'AB', 'AC')
            .withCurrent('AA')
            .build();
        var queryNoDepends = queryBuilder()
            .withId('queryNoDepends')
            .withName('queryNoDepends')
            .withQuery('*')
            .withOptions('A', 'B', 'C')
            .withCurrent('A')
            .build();
        var list = [custom, queryDependsOnCustom, queryNoDepends];
        setVariableQueryRunner(new VariableQueryRunner());
        return {
            custom: custom,
            queryDependsOnCustom: queryDependsOnCustom,
            queryNoDepends: queryNoDepends,
            list: list,
        };
    };
    // testing processVariable for the custom variable from case described above
    describe('when processVariable is dispatched for a custom variable without dependencies', function () {
        describe('and queryParams does not match variable', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, list, custom, queryParams, tester;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getAndSetupProcessVariableContext(), list = _a.list, custom = _a.custom;
                            queryParams = {};
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getTemplatingRootReducer())
                                    .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                    .whenActionIsDispatched(initDashboardTemplating(list))
                                    .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams), true)];
                        case 1:
                            tester = _b.sent();
                            return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateCompleted(toVariablePayload(custom)))];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and queryParams does match variable', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, list, custom, queryParams, tester;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getAndSetupProcessVariableContext(), list = _a.list, custom = _a.custom;
                            queryParams = { 'var-custom': 'B' };
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getTemplatingRootReducer())
                                    .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                    .whenActionIsDispatched(initDashboardTemplating(list))
                                    .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams), true)];
                        case 1:
                            tester = _b.sent();
                            return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: 'custom' }, { option: { text: 'B', value: 'B', selected: false } })), variableStateCompleted(toVariablePayload(custom)))];
                        case 2:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    // testing processVariable for the queryNoDepends variable from case described above
    describe('when processVariable is dispatched for a query variable without dependencies', function () {
        describe('and queryParams does not match variable', function () {
            var queryParams = {};
            describe('and refresh is VariableRefresh.never', function () {
                var refresh = VariableRefresh.never;
                it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, list, queryNoDepends, tester;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = getAndSetupProcessVariableContext(), list = _a.list, queryNoDepends = _a.queryNoDepends;
                                queryNoDepends.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true)];
                            case 1:
                                tester = _b.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateCompleted(toVariablePayload(queryNoDepends)))];
                            case 2:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        refresh\n        ", "\n        ", "\n      "], ["\n        refresh\n        ", "\n        ", "\n      "])), VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged)('and refresh is $refresh then correct actions are dispatched', function (_a) {
                var refresh = _a.refresh;
                return __awaiter(void 0, void 0, void 0, function () {
                    var _b, list, queryNoDepends, tester;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = getAndSetupProcessVariableContext(), list = _b.list, queryNoDepends = _b.queryNoDepends;
                                queryNoDepends.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true)];
                            case 1:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'query', id: 'queryNoDepends' })), updateVariableOptions(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, {
                                        results: [
                                            { value: 'A', text: 'A' },
                                            { value: 'B', text: 'B' },
                                            { value: 'C', text: 'C' },
                                        ],
                                        templatedRegex: '',
                                    })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, { option: { text: 'A', value: 'A', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' })))];
                            case 2:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
        describe('and queryParams does match variable', function () {
            var queryParams = { 'var-queryNoDepends': 'B' };
            describe('and refresh is VariableRefresh.never', function () {
                var refresh = VariableRefresh.never;
                it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, list, queryNoDepends, tester;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = getAndSetupProcessVariableContext(), list = _a.list, queryNoDepends = _a.queryNoDepends;
                                queryNoDepends.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true)];
                            case 1:
                                tester = _b.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, { option: { text: 'B', value: 'B', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' })))];
                            case 2:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        refresh\n        ", "\n        ", "\n      "], ["\n        refresh\n        ", "\n        ", "\n      "])), VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged)('and refresh is $refresh then correct actions are dispatched', function (_a) {
                var refresh = _a.refresh;
                return __awaiter(void 0, void 0, void 0, function () {
                    var _b, list, queryNoDepends, tester;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = getAndSetupProcessVariableContext(), list = _b.list, queryNoDepends = _b.queryNoDepends;
                                queryNoDepends.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true)];
                            case 1:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'query', id: 'queryNoDepends' })), updateVariableOptions(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, {
                                        results: [
                                            { value: 'A', text: 'A' },
                                            { value: 'B', text: 'B' },
                                            { value: 'C', text: 'C' },
                                        ],
                                        templatedRegex: '',
                                    })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, { option: { text: 'A', value: 'A', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryNoDepends' }, { option: { text: 'B', value: 'B', selected: false } })))];
                            case 2:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
    });
    // testing processVariable for the queryDependsOnCustom variable from case described above
    describe('when processVariable is dispatched for a query variable with one dependency', function () {
        describe('and queryParams does not match variable', function () {
            var queryParams = {};
            describe('and refresh is VariableRefresh.never', function () {
                var refresh = VariableRefresh.never;
                it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, list, custom, queryDependsOnCustom, customProcessed, tester;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = getAndSetupProcessVariableContext(), list = _a.list, custom = _a.custom, queryDependsOnCustom = _a.queryDependsOnCustom;
                                queryDependsOnCustom.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams))];
                            case 1:
                                customProcessed = _b.sent();
                                return [4 /*yield*/, customProcessed.whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams), true)];
                            case 2:
                                tester = _b.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))];
                            case 3:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            it.each(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        refresh\n        ", "\n        ", "\n      "], ["\n        refresh\n        ", "\n        ", "\n      "])), VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged)('and refresh is $refresh then correct actions are dispatched', function (_a) {
                var refresh = _a.refresh;
                return __awaiter(void 0, void 0, void 0, function () {
                    var _b, list, custom, queryDependsOnCustom, customProcessed, tester;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = getAndSetupProcessVariableContext(), list = _b.list, custom = _b.custom, queryDependsOnCustom = _b.queryDependsOnCustom;
                                queryDependsOnCustom.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams))];
                            case 1:
                                customProcessed = _c.sent();
                                return [4 /*yield*/, customProcessed.whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams), true)];
                            case 2:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })), updateVariableOptions(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, {
                                        results: [
                                            { value: 'AA', text: 'AA' },
                                            { value: 'AB', text: 'AB' },
                                            { value: 'AC', text: 'AC' },
                                        ],
                                        templatedRegex: '',
                                    })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, { option: { text: 'AA', value: 'AA', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))];
                            case 3:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
        describe('and queryParams does match variable', function () {
            var queryParams = { 'var-queryDependsOnCustom': 'AB' };
            describe('and refresh is VariableRefresh.never', function () {
                var refresh = VariableRefresh.never;
                it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, list, custom, queryDependsOnCustom, customProcessed, tester;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = getAndSetupProcessVariableContext(), list = _a.list, custom = _a.custom, queryDependsOnCustom = _a.queryDependsOnCustom;
                                queryDependsOnCustom.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams))];
                            case 1:
                                customProcessed = _b.sent();
                                return [4 /*yield*/, customProcessed.whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams), true)];
                            case 2:
                                tester = _b.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, { option: { text: 'AB', value: 'AB', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))];
                            case 3:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            });
            it.each(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        refresh\n        ", "\n        ", "\n      "], ["\n        refresh\n        ", "\n        ", "\n      "])), VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged)('and refresh is $refresh then correct actions are dispatched', function (_a) {
                var refresh = _a.refresh;
                return __awaiter(void 0, void 0, void 0, function () {
                    var _b, list, custom, queryDependsOnCustom, customProcessed, tester;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = getAndSetupProcessVariableContext(), list = _b.list, custom = _b.custom, queryDependsOnCustom = _b.queryDependsOnCustom;
                                queryDependsOnCustom.refresh = refresh;
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                        .whenActionIsDispatched(initDashboardTemplating(list))
                                        .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams))];
                            case 1:
                                customProcessed = _c.sent();
                                return [4 /*yield*/, customProcessed.whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams), true)];
                            case 2:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })), updateVariableOptions(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, {
                                        results: [
                                            { value: 'AA', text: 'AA' },
                                            { value: 'AB', text: 'AB' },
                                            { value: 'AC', text: 'AC' },
                                        ],
                                        templatedRegex: '',
                                    })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, { option: { text: 'AA', value: 'AA', selected: false } })), variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })), setCurrentVariableValue(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }, { option: { text: 'AB', value: 'AB', selected: false } })))];
                            case 3:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
    });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=processVariable.test.js.map