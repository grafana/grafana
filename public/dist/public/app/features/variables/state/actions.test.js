import { __assign, __awaiter, __generator, __makeTemplateObject, __read, __spreadArray } from "tslib";
import { getRootReducer, getTemplatingRootReducer } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createTextBoxVariableAdapter } from '../textbox/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { cancelVariables, changeVariableMultiValue, cleanUpVariables, fixSelectedInconsistency, initDashboardTemplating, initVariablesTransaction, isVariableUrlValueDifferentFromCurrent, processVariables, validateVariableSelectionState, } from './actions';
import { addVariable, changeVariableProp, removeVariable, setCurrentVariableValue, variableStateCompleted, variableStateFetching, variableStateNotStarted, } from './sharedReducer';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, NEW_VARIABLE_ID, toVariableIdentifier, toVariablePayload, } from './types';
import { constantBuilder, customBuilder, datasourceBuilder, queryBuilder, textboxBuilder, } from '../shared/testing/builders';
import { changeVariableName } from '../editor/actions';
import { changeVariableNameFailed, changeVariableNameSucceeded, cleanEditorState, initialVariableEditorState, setIdInEditor, } from '../editor/reducer';
import { TransactionStatus, variablesClearTransaction, variablesCompleteTransaction, variablesInitTransaction, } from './transactionReducer';
import { cleanPickerState, initialState } from '../pickers/OptionsPicker/reducer';
import { cleanVariables } from './variablesReducer';
import { expect } from '../../../../test/lib/common';
import { VariableRefresh } from '../types';
import { updateVariableOptions } from '../query/reducer';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import { setDataSourceSrv, setLocationService } from '@grafana/runtime';
import { LoadingState } from '@grafana/data';
import { toAsyncOfResult } from '../../query/state/DashboardQueryRunner/testHelpers';
variableAdapters.setInit(function () { return [
    createQueryVariableAdapter(),
    createCustomVariableAdapter(),
    createTextBoxVariableAdapter(),
    createConstantVariableAdapter(),
]; });
var metricFindQuery = jest
    .fn()
    .mockResolvedValueOnce([{ text: 'responses' }, { text: 'timers' }])
    .mockResolvedValue([{ text: '200' }, { text: '500' }]);
var getMetricSources = jest.fn().mockReturnValue([]);
var getDatasource = jest.fn().mockResolvedValue({ metricFindQuery: metricFindQuery });
jest.mock('app/features/dashboard/services/TimeSrv', function () { return ({
    getTimeSrv: function () { return ({
        timeRange: jest.fn().mockReturnValue(undefined),
    }); },
}); });
setDataSourceSrv({
    get: getDatasource,
    getList: getMetricSources,
});
describe('shared actions', function () {
    describe('when initDashboardTemplating is dispatched', function () {
        it('then correct actions are dispatched', function () {
            var query = queryBuilder().build();
            var constant = constantBuilder().build();
            var datasource = datasourceBuilder().build();
            var custom = customBuilder().build();
            var textbox = textboxBuilder().build();
            var list = [query, constant, datasource, custom, textbox];
            reduxTester()
                .givenRootReducer(getTemplatingRootReducer())
                .whenActionIsDispatched(initDashboardTemplating(list))
                .thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                expect(dispatchedActions.length).toEqual(8);
                expect(dispatchedActions[0]).toEqual(addVariable(toVariablePayload(query, { global: false, index: 0, model: query })));
                expect(dispatchedActions[1]).toEqual(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })));
                expect(dispatchedActions[2]).toEqual(addVariable(toVariablePayload(custom, { global: false, index: 2, model: custom })));
                expect(dispatchedActions[3]).toEqual(addVariable(toVariablePayload(textbox, { global: false, index: 3, model: textbox })));
                // because uuid are dynamic we need to get the uuid from the resulting state
                // an alternative would be to add our own uuids in the model above instead
                expect(dispatchedActions[4]).toEqual(variableStateNotStarted(toVariablePayload(__assign(__assign({}, query), { id: dispatchedActions[4].payload.id }))));
                expect(dispatchedActions[5]).toEqual(variableStateNotStarted(toVariablePayload(__assign(__assign({}, constant), { id: dispatchedActions[5].payload.id }))));
                expect(dispatchedActions[6]).toEqual(variableStateNotStarted(toVariablePayload(__assign(__assign({}, custom), { id: dispatchedActions[6].payload.id }))));
                expect(dispatchedActions[7]).toEqual(variableStateNotStarted(toVariablePayload(__assign(__assign({}, textbox), { id: dispatchedActions[7].payload.id }))));
                return true;
            });
        });
    });
    describe('when processVariables is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var query, constant, datasource, custom, textbox, list, preloadedState, locationService, variableQueryRunner, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = queryBuilder().build();
                        constant = constantBuilder().build();
                        datasource = datasourceBuilder().build();
                        custom = customBuilder().build();
                        textbox = textboxBuilder().build();
                        list = [query, constant, datasource, custom, textbox];
                        preloadedState = {
                            templating: {},
                        };
                        locationService = { getSearchObject: function () { return ({}); } };
                        setLocationService(locationService);
                        variableQueryRunner = {
                            cancelRequest: jest.fn(),
                            queueRequest: jest.fn(),
                            getResponse: function () { return toAsyncOfResult({ state: LoadingState.Done, identifier: toVariableIdentifier(query) }); },
                            destroy: jest.fn(),
                        };
                        setVariableQueryRunner(variableQueryRunner);
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getTemplatingRootReducer())
                                .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                .whenActionIsDispatched(initDashboardTemplating(list))
                                .whenAsyncActionIsDispatched(processVariables(), true)];
                    case 1:
                        tester = _a.sent();
                        return [4 /*yield*/, tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                                expect(dispatchedActions.length).toEqual(5);
                                expect(dispatchedActions[0]).toEqual(variableStateFetching(toVariablePayload(__assign(__assign({}, query), { id: dispatchedActions[0].payload.id }))));
                                expect(dispatchedActions[1]).toEqual(variableStateCompleted(toVariablePayload(__assign(__assign({}, constant), { id: dispatchedActions[1].payload.id }))));
                                expect(dispatchedActions[2]).toEqual(variableStateCompleted(toVariablePayload(__assign(__assign({}, custom), { id: dispatchedActions[2].payload.id }))));
                                expect(dispatchedActions[3]).toEqual(variableStateCompleted(toVariablePayload(__assign(__assign({}, textbox), { id: dispatchedActions[3].payload.id }))));
                                expect(dispatchedActions[4]).toEqual(variableStateCompleted(toVariablePayload(__assign(__assign({}, query), { id: dispatchedActions[4].payload.id }))));
                                return true;
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // Fix for https://github.com/grafana/grafana/issues/28791
        it('fix for https://github.com/grafana/grafana/issues/28791', function () { return __awaiter(void 0, void 0, void 0, function () {
            var stats, substats, list, query, locationService, preloadedState, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setVariableQueryRunner(new VariableQueryRunner());
                        stats = queryBuilder()
                            .withId('stats')
                            .withName('stats')
                            .withQuery('stats.*')
                            .withRefresh(VariableRefresh.onDashboardLoad)
                            .withCurrent(['response'], ['response'])
                            .withMulti()
                            .withIncludeAll()
                            .build();
                        substats = queryBuilder()
                            .withId('substats')
                            .withName('substats')
                            .withQuery('stats.$stats.*')
                            .withRefresh(VariableRefresh.onDashboardLoad)
                            .withCurrent([ALL_VARIABLE_TEXT], [ALL_VARIABLE_VALUE])
                            .withMulti()
                            .withIncludeAll()
                            .build();
                        list = [stats, substats];
                        query = { orgId: '1', 'var-stats': 'response', 'var-substats': ALL_VARIABLE_TEXT };
                        locationService = { getSearchObject: function () { return query; } };
                        setLocationService(locationService);
                        preloadedState = {
                            templating: {},
                        };
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getTemplatingRootReducer())
                                .whenActionIsDispatched(variablesInitTransaction({ uid: '' }))
                                .whenActionIsDispatched(initDashboardTemplating(list))
                                .whenAsyncActionIsDispatched(processVariables(), true)];
                    case 1:
                        tester = _a.sent();
                        return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(variableStateFetching(toVariablePayload(stats)), updateVariableOptions(toVariablePayload(stats, { results: [{ text: 'responses' }, { text: 'timers' }], templatedRegex: '' })), setCurrentVariableValue(toVariablePayload(stats, { option: { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false } })), variableStateCompleted(toVariablePayload(stats)), setCurrentVariableValue(toVariablePayload(stats, { option: { text: ['response'], value: ['response'], selected: false } })), variableStateFetching(toVariablePayload(substats)), updateVariableOptions(toVariablePayload(substats, { results: [{ text: '200' }, { text: '500' }], templatedRegex: '' })), setCurrentVariableValue(toVariablePayload(substats, {
                                option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: true },
                            })), variableStateCompleted(toVariablePayload(substats)), setCurrentVariableValue(toVariablePayload(substats, {
                                option: { text: [ALL_VARIABLE_TEXT], value: [ALL_VARIABLE_VALUE], selected: false },
                            })))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when validateVariableSelectionState is dispatched with a custom variable (no dependencies)', function () {
        describe('and not multivalue', function () {
            it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        withOptions        | withCurrent  | defaultValue | expected\n        ", " | ", " | ", " | ", "\n        ", " | ", "       | ", " | ", "\n        ", " | ", "       | ", "       | ", "\n        ", " | ", "       | ", " | ", "\n        ", " | ", "       | ", "       | ", "\n        ", "       | ", "       | ", " | ", "\n      "], ["\n        withOptions        | withCurrent  | defaultValue | expected\n        ", " | ", " | ", " | ", "\n        ", " | ", "       | ", " | ", "\n        ", " | ", "       | ", "       | ", "\n        ", " | ", "       | ", " | ", "\n        ", " | ", "       | ", "       | ", "\n        ", "       | ", "       | ", " | ", "\n      "])), ['A', 'B', 'C'], undefined, undefined, 'A', ['A', 'B', 'C'], 'B', undefined, 'B', ['A', 'B', 'C'], 'B', 'C', 'B', ['A', 'B', 'C'], 'X', undefined, 'A', ['A', 'B', 'C'], 'X', 'C', 'C', undefined, 'B', undefined, 'should not dispatch setCurrentVariableValue')('then correct actions are dispatched', function (_a) {
                var withOptions = _a.withOptions, withCurrent = _a.withCurrent, defaultValue = _a.defaultValue, expected = _a.expected;
                return __awaiter(void 0, void 0, void 0, function () {
                    var custom, tester;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (!withOptions) {
                                    custom = customBuilder().withId('0').withCurrent(withCurrent).withoutOptions().build();
                                }
                                else {
                                    custom = (_b = customBuilder()
                                        .withId('0'))
                                        .withOptions.apply(_b, __spreadArray([], __read(withOptions), false)).withCurrent(withCurrent)
                                        .build();
                                }
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                                        .whenAsyncActionIsDispatched(validateVariableSelectionState(toVariableIdentifier(custom), defaultValue), true)];
                            case 1:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                                        var expectedActions = !withOptions
                                            ? []
                                            : [
                                                setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: expected, value: expected, selected: false } })),
                                            ];
                                        expect(dispatchedActions).toEqual(expectedActions);
                                        return true;
                                    })];
                            case 2:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
        describe('and multivalue', function () {
            it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        withOptions        | withCurrent   | defaultValue | expectedText  | expectedSelected\n        ", " | ", "      | ", " | ", "      | ", "\n        ", " | ", "      | ", "       | ", "      | ", "\n        ", " | ", " | ", " | ", " | ", "\n        ", " | ", " | ", "       | ", " | ", "\n        ", " | ", "      | ", " | ", "        | ", "\n        ", " | ", "      | ", "       | ", "        | ", "\n      "], ["\n        withOptions        | withCurrent   | defaultValue | expectedText  | expectedSelected\n        ", " | ", "      | ", " | ", "      | ", "\n        ", " | ", "      | ", "       | ", "      | ", "\n        ", " | ", " | ", " | ", " | ", "\n        ", " | ", " | ", "       | ", " | ", "\n        ", " | ", "      | ", " | ", "        | ", "\n        ", " | ", "      | ", "       | ", "        | ", "\n      "])), ['A', 'B', 'C'], ['B'], undefined, ['B'], true, ['A', 'B', 'C'], ['B'], 'C', ['B'], true, ['A', 'B', 'C'], ['B', 'C'], undefined, ['B', 'C'], true, ['A', 'B', 'C'], ['B', 'C'], 'C', ['B', 'C'], true, ['A', 'B', 'C'], ['X'], undefined, 'A', false, ['A', 'B', 'C'], ['X'], 'C', 'A', false)('then correct actions are dispatched', function (_a) {
                var withOptions = _a.withOptions, withCurrent = _a.withCurrent, defaultValue = _a.defaultValue, expectedText = _a.expectedText, expectedSelected = _a.expectedSelected;
                return __awaiter(void 0, void 0, void 0, function () {
                    var custom, tester;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (!withOptions) {
                                    custom = customBuilder().withId('0').withMulti().withCurrent(withCurrent).withoutOptions().build();
                                }
                                else {
                                    custom = (_b = customBuilder()
                                        .withId('0')
                                        .withMulti())
                                        .withOptions.apply(_b, __spreadArray([], __read(withOptions), false)).withCurrent(withCurrent)
                                        .build();
                                }
                                return [4 /*yield*/, reduxTester()
                                        .givenRootReducer(getTemplatingRootReducer())
                                        .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                                        .whenAsyncActionIsDispatched(validateVariableSelectionState(toVariableIdentifier(custom), defaultValue), true)];
                            case 1:
                                tester = _c.sent();
                                return [4 /*yield*/, tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                                        var expectedActions = !withOptions
                                            ? []
                                            : [
                                                setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: expectedText, value: expectedText, selected: expectedSelected } })),
                                            ];
                                        expect(dispatchedActions).toEqual(expectedActions);
                                        return true;
                                    })];
                            case 2:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
        });
    });
    describe('changeVariableName', function () {
        describe('when changeVariableName is dispatched with the same name', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId('constant').withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), constant.name), true)
                    .thenDispatchedActionsShouldEqual(changeVariableNameSucceeded({ type: 'constant', id: 'constant', data: { newName: 'constant' } }));
            });
        });
        describe('when changeVariableName is dispatched with an unique name', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId('constant').withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'constant1'), true)
                    .thenDispatchedActionsShouldEqual(addVariable({
                    type: 'constant',
                    id: 'constant1',
                    data: {
                        global: false,
                        index: 1,
                        model: __assign(__assign({}, constant), { name: 'constant1', id: 'constant1', global: false, index: 1, current: { selected: true, text: '', value: '' }, options: [{ selected: true, text: '', value: '' }] }),
                    },
                }), changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } }), setIdInEditor({ id: 'constant1' }), removeVariable({ type: 'constant', id: 'constant', data: { reIndex: false } }));
            });
        });
        describe('when changeVariableName is dispatched with an unique name for a new variable', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId(NEW_VARIABLE_ID).withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'constant1'), true)
                    .thenDispatchedActionsShouldEqual(addVariable({
                    type: 'constant',
                    id: 'constant1',
                    data: {
                        global: false,
                        index: 1,
                        model: __assign(__assign({}, constant), { name: 'constant1', id: 'constant1', global: false, index: 1, current: { selected: true, text: '', value: '' }, options: [{ selected: true, text: '', value: '' }] }),
                    },
                }), changeVariableNameSucceeded({ type: 'constant', id: 'constant1', data: { newName: 'constant1' } }), setIdInEditor({ id: 'constant1' }), removeVariable({ type: 'constant', id: NEW_VARIABLE_ID, data: { reIndex: false } }));
            });
        });
        describe('when changeVariableName is dispatched with __newName', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId('constant').withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), '__newName'), true)
                    .thenDispatchedActionsShouldEqual(changeVariableNameFailed({
                    newName: '__newName',
                    errorText: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
                }));
            });
        });
        describe('when changeVariableName is dispatched with illegal characters', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId('constant').withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), '#constant!'), true)
                    .thenDispatchedActionsShouldEqual(changeVariableNameFailed({
                    newName: '#constant!',
                    errorText: 'Only word and digit characters are allowed in variable names',
                }));
            });
        });
        describe('when changeVariableName is dispatched with a name that is already used', function () {
            it('then the correct actions are dispatched', function () {
                var textbox = textboxBuilder().withId('textbox').withName('textbox').build();
                var constant = constantBuilder().withId('constant').withName('constant').build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(textbox, { global: false, index: 0, model: textbox })))
                    .whenActionIsDispatched(addVariable(toVariablePayload(constant, { global: false, index: 1, model: constant })))
                    .whenActionIsDispatched(changeVariableName(toVariableIdentifier(constant), 'textbox'), true)
                    .thenDispatchedActionsShouldEqual(changeVariableNameFailed({
                    newName: 'textbox',
                    errorText: 'Variable with the same name already exists',
                }));
            });
        });
    });
    describe('changeVariableMultiValue', function () {
        describe('when changeVariableMultiValue is dispatched for variable with multi enabled', function () {
            it('then correct actions are dispatched', function () {
                var custom = customBuilder().withId('custom').withMulti(true).withCurrent(['A'], ['A']).build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                    .whenActionIsDispatched(changeVariableMultiValue(toVariableIdentifier(custom), false), true)
                    .thenDispatchedActionsShouldEqual(changeVariableProp(toVariablePayload(custom, {
                    propName: 'multi',
                    propValue: false,
                })), changeVariableProp(toVariablePayload(custom, {
                    propName: 'current',
                    propValue: {
                        value: 'A',
                        text: 'A',
                        selected: true,
                    },
                })));
            });
        });
        describe('when changeVariableMultiValue is dispatched for variable with multi disabled', function () {
            it('then correct actions are dispatched', function () {
                var custom = customBuilder().withId('custom').withMulti(false).withCurrent(['A'], ['A']).build();
                reduxTester()
                    .givenRootReducer(getTemplatingRootReducer())
                    .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                    .whenActionIsDispatched(changeVariableMultiValue(toVariableIdentifier(custom), true), true)
                    .thenDispatchedActionsShouldEqual(changeVariableProp(toVariablePayload(custom, {
                    propName: 'multi',
                    propValue: true,
                })), changeVariableProp(toVariablePayload(custom, {
                    propName: 'current',
                    propValue: {
                        value: ['A'],
                        text: ['A'],
                        selected: true,
                    },
                })));
            });
        });
    });
    describe('initVariablesTransaction', function () {
        var constant = constantBuilder().withId('constant').withName('constant').build();
        var templating = { list: [constant] };
        var uid = 'uid';
        var dashboard = { title: 'Some dash', uid: uid, templating: templating };
        describe('when called and the previous dashboard has completed', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var tester;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard))];
                        case 1:
                            tester = _a.sent();
                            tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                                expect(dispatchedActions[0]).toEqual(variablesInitTransaction({ uid: uid }));
                                expect(dispatchedActions[1].type).toEqual(addVariable.type);
                                expect(dispatchedActions[1].payload.id).toEqual('__dashboard');
                                expect(dispatchedActions[2].type).toEqual(addVariable.type);
                                expect(dispatchedActions[2].payload.id).toEqual('__org');
                                expect(dispatchedActions[3].type).toEqual(addVariable.type);
                                expect(dispatchedActions[3].payload.id).toEqual('__user');
                                expect(dispatchedActions[4]).toEqual(addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant })));
                                expect(dispatchedActions[5]).toEqual(variableStateNotStarted(toVariablePayload(constant)));
                                expect(dispatchedActions[6]).toEqual(variableStateCompleted(toVariablePayload(constant)));
                                expect(dispatchedActions[7]).toEqual(variablesCompleteTransaction({ uid: uid }));
                                return dispatchedActions.length === 8;
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when called and the previous dashboard is still processing variables', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var transactionState, tester;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            transactionState = { uid: 'previous-uid', status: TransactionStatus.Fetching };
                            return [4 /*yield*/, reduxTester({
                                    preloadedState: {
                                        templating: {
                                            transaction: transactionState,
                                            variables: {},
                                            optionsPicker: __assign({}, initialState),
                                            editor: __assign({}, initialVariableEditorState),
                                        },
                                    },
                                })
                                    .givenRootReducer(getRootReducer())
                                    .whenAsyncActionIsDispatched(initVariablesTransaction(uid, dashboard))];
                        case 1:
                            tester = _a.sent();
                            tester.thenDispatchedActionsPredicateShouldEqual(function (dispatchedActions) {
                                expect(dispatchedActions[0]).toEqual(cleanVariables());
                                expect(dispatchedActions[1]).toEqual(cleanEditorState());
                                expect(dispatchedActions[2]).toEqual(cleanPickerState());
                                expect(dispatchedActions[3]).toEqual(variablesClearTransaction());
                                expect(dispatchedActions[4]).toEqual(variablesInitTransaction({ uid: uid }));
                                expect(dispatchedActions[5].type).toEqual(addVariable.type);
                                expect(dispatchedActions[5].payload.id).toEqual('__dashboard');
                                expect(dispatchedActions[6].type).toEqual(addVariable.type);
                                expect(dispatchedActions[6].payload.id).toEqual('__org');
                                expect(dispatchedActions[7].type).toEqual(addVariable.type);
                                expect(dispatchedActions[7].payload.id).toEqual('__user');
                                expect(dispatchedActions[8]).toEqual(addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant })));
                                expect(dispatchedActions[9]).toEqual(variableStateNotStarted(toVariablePayload(constant)));
                                expect(dispatchedActions[10]).toEqual(variableStateCompleted(toVariablePayload(constant)));
                                expect(dispatchedActions[11]).toEqual(variablesCompleteTransaction({ uid: uid }));
                                return dispatchedActions.length === 12;
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('cleanUpVariables', function () {
        describe('when called', function () {
            it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    reduxTester()
                        .givenRootReducer(getTemplatingRootReducer())
                        .whenActionIsDispatched(cleanUpVariables())
                        .thenDispatchedActionsShouldEqual(cleanVariables(), cleanEditorState(), cleanPickerState(), variablesClearTransaction());
                    return [2 /*return*/];
                });
            }); });
        });
    });
    describe('cancelVariables', function () {
        var cancelAllInFlightRequestsMock = jest.fn();
        var backendSrvMock = {
            cancelAllInFlightRequests: cancelAllInFlightRequestsMock,
        };
        describe('when called', function () {
            it('then cancelAllInFlightRequests should be called and correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    reduxTester()
                        .givenRootReducer(getTemplatingRootReducer())
                        .whenActionIsDispatched(cancelVariables({ getBackendSrv: function () { return backendSrvMock; } }))
                        .thenDispatchedActionsShouldEqual(cleanVariables(), cleanEditorState(), cleanPickerState(), variablesClearTransaction());
                    expect(cancelAllInFlightRequestsMock).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
                });
            }); });
        });
    });
    describe('fixSelectedInconsistency', function () {
        describe('when called for a single value variable', function () {
            describe('and there is an inconsistency between current and selected in options', function () {
                it('then it should set the correct selected', function () {
                    var variable = customBuilder().withId('custom').withCurrent('A').withOptions('A', 'B', 'C').build();
                    variable.options[1].selected = true;
                    expect(variable.options).toEqual([
                        { text: 'A', value: 'A', selected: false },
                        { text: 'B', value: 'B', selected: true },
                        { text: 'C', value: 'C', selected: false },
                    ]);
                    fixSelectedInconsistency(variable);
                    expect(variable.options).toEqual([
                        { text: 'A', value: 'A', selected: true },
                        { text: 'B', value: 'B', selected: false },
                        { text: 'C', value: 'C', selected: false },
                    ]);
                });
            });
            describe('and there is no matching option in options', function () {
                it('then the first option should be selected', function () {
                    var variable = customBuilder().withId('custom').withCurrent('A').withOptions('X', 'Y', 'Z').build();
                    expect(variable.options).toEqual([
                        { text: 'X', value: 'X', selected: false },
                        { text: 'Y', value: 'Y', selected: false },
                        { text: 'Z', value: 'Z', selected: false },
                    ]);
                    fixSelectedInconsistency(variable);
                    expect(variable.options).toEqual([
                        { text: 'X', value: 'X', selected: true },
                        { text: 'Y', value: 'Y', selected: false },
                        { text: 'Z', value: 'Z', selected: false },
                    ]);
                });
            });
        });
        describe('when called for a multi value variable', function () {
            describe('and there is an inconsistency between current and selected in options', function () {
                it('then it should set the correct selected', function () {
                    var variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('A', 'B', 'C').build();
                    variable.options[1].selected = true;
                    expect(variable.options).toEqual([
                        { text: 'A', value: 'A', selected: false },
                        { text: 'B', value: 'B', selected: true },
                        { text: 'C', value: 'C', selected: false },
                    ]);
                    fixSelectedInconsistency(variable);
                    expect(variable.options).toEqual([
                        { text: 'A', value: 'A', selected: true },
                        { text: 'B', value: 'B', selected: false },
                        { text: 'C', value: 'C', selected: true },
                    ]);
                });
            });
            describe('and there is no matching option in options', function () {
                it('then the first option should be selected', function () {
                    var variable = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('X', 'Y', 'Z').build();
                    expect(variable.options).toEqual([
                        { text: 'X', value: 'X', selected: false },
                        { text: 'Y', value: 'Y', selected: false },
                        { text: 'Z', value: 'Z', selected: false },
                    ]);
                    fixSelectedInconsistency(variable);
                    expect(variable.options).toEqual([
                        { text: 'X', value: 'X', selected: true },
                        { text: 'Y', value: 'Y', selected: false },
                        { text: 'Z', value: 'Z', selected: false },
                    ]);
                });
            });
        });
    });
    describe('isVariableUrlValueDifferentFromCurrent', function () {
        describe('when called with a single valued variable', function () {
            describe('and values are equal', function () {
                it('then it should return false', function () {
                    var variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
                    var urlValue = 'A';
                    expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
                });
            });
            describe('and values are different', function () {
                it('then it should return true', function () {
                    var variable = queryBuilder().withMulti(false).withCurrent('A', 'A').build();
                    var urlValue = 'B';
                    expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
                });
            });
        });
        describe('when called with a multi valued variable', function () {
            describe('and values are equal', function () {
                it('then it should return false', function () {
                    var variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
                    var urlValue = ['A'];
                    expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
                });
                describe('but urlValue is not an array', function () {
                    it('then it should return false', function () {
                        var variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
                        var urlValue = 'A';
                        expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(false);
                    });
                });
            });
            describe('and values are different', function () {
                it('then it should return true', function () {
                    var variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
                    var urlValue = ['C'];
                    expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
                });
                describe('but urlValue is not an array', function () {
                    it('then it should return true', function () {
                        var variable = queryBuilder().withMulti(true).withCurrent(['A'], ['A']).build();
                        var urlValue = 'C';
                        expect(isVariableUrlValueDifferentFromCurrent(variable, urlValue)).toBe(true);
                    });
                });
            });
        });
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=actions.test.js.map