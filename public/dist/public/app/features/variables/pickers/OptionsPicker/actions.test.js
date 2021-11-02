import { __assign, __awaiter, __generator } from "tslib";
import { reduxTester } from '../../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../../state/helpers';
import { initialVariableModelState, VariableRefresh, VariableSort } from '../../types';
import { hideOptions, initialState, moveOptionsHighlight, showOptions, toggleOption, updateOptionsAndFilter, updateSearchQuery, } from './reducer';
import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions, toggleOptionByHighlight, } from './actions';
import { NavigationKey } from '../types';
import { toVariablePayload } from '../../state/types';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { variableAdapters } from '../../adapters';
import { createQueryVariableAdapter } from '../../query/adapter';
import { locationService } from '@grafana/runtime';
import { queryBuilder } from '../../shared/testing/builders';
var datasource = {
    metricFindQuery: jest.fn(function () { return Promise.resolve([]); }),
};
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getDataSourceSrv: jest.fn(function () { return ({
            get: function () { return datasource; },
        }); }), locationService: {
            partial: jest.fn(),
            getSearchObject: function () { return ({}); },
        } });
});
describe('options picker actions', function () {
    variableAdapters.setInit(function () { return [createQueryVariableAdapter()]; });
    describe('when navigateOptions is dispatched with navigation key cancel', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, clearOthers, key, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        variable = createMultiVariable({
                            options: [createOption('A', 'A', true)],
                            current: createOption(['A'], ['A'], true),
                        });
                        clearOthers = false;
                        key = NavigationKey.cancel;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        option = __assign(__assign({}, createOption(['A'])), { selected: true, value: ['A'] });
                        tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })), changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })), hideOptions());
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when navigateOptions is dispatched with navigation key select without clearOthers', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var option, variable, clearOthers, key, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        option = createOption('A', 'A', true);
                        variable = createMultiVariable({
                            options: [option],
                            current: createOption(['A'], ['A'], true),
                            includeAll: false,
                        });
                        clearOthers = false;
                        key = NavigationKey.select;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, false))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: option, forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when navigateOptions is dispatched with navigation key select with clearOthers', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var option, variable, clearOthers, key, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        option = createOption('A', 'A', true);
                        variable = createMultiVariable({
                            options: [option],
                            current: createOption(['A'], ['A'], true),
                            includeAll: false,
                        });
                        clearOthers = true;
                        key = NavigationKey.select;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: option, forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when navigateOptions is dispatched with navigation key select after highlighting the third option', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, key, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = true;
                        key = NavigationKey.select;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: options[2], forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when navigateOptions is dispatched with navigation key select after highlighting the second option', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, key, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = true;
                        key = NavigationKey.select;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: options[1], forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when navigateOptions is dispatched with navigation key selectAndClose after highlighting the second option', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, key, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = false;
                        key = NavigationKey.selectAndClose;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveUp, clearOthers))
                                .whenAsyncActionIsDispatched(navigateOptions(key, clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        option = __assign(__assign({}, createOption(['B'])), { selected: true, value: ['B'] });
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: options[1], forceSelect: true, clearOthers: clearOthers }), setCurrentVariableValue(toVariablePayload(variable, { option: option })), changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })), hideOptions(), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': ['B'] });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when filterOrSearchOptions is dispatched with simple filter', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, filter, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        filter = 'A';
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenAsyncActionIsDispatched(filterOrSearchOptions(filter), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(updateSearchQuery(filter), updateOptionsAndFilter(variable.options));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when openOptions is dispatched and there is no picker state yet', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, preloadedState, tester;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        variable = queryBuilder()
                            .withId('query0')
                            .withName('query0')
                            .withMulti()
                            .withCurrent(['A', 'C'])
                            .withOptions('A', 'B', 'C')
                            .build();
                        preloadedState = {
                            templating: {
                                variables: (_a = {},
                                    _a[variable.id] = __assign({}, variable),
                                    _a),
                                optionsPicker: __assign({}, initialState),
                            },
                        };
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(openOptions(variable, undefined))];
                    case 1:
                        tester = _b.sent();
                        tester.thenDispatchedActionsShouldEqual(showOptions(variable));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when openOptions is dispatched and picker.id is same as variable.id', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variable, preloadedState, tester;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        variable = queryBuilder()
                            .withId('query0')
                            .withName('query0')
                            .withMulti()
                            .withCurrent(['A', 'C'])
                            .withOptions('A', 'B', 'C')
                            .build();
                        preloadedState = {
                            templating: {
                                variables: (_a = {},
                                    _a[variable.id] = __assign({}, variable),
                                    _a),
                                optionsPicker: __assign(__assign({}, initialState), { id: variable.id }),
                            },
                        };
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(openOptions(variable, undefined))];
                    case 1:
                        tester = _b.sent();
                        tester.thenDispatchedActionsShouldEqual(showOptions(variable));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when openOptions is dispatched and picker.id is not the same as variable.id', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var variableInPickerState, variable, preloadedState, tester;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        variableInPickerState = queryBuilder()
                            .withId('query1')
                            .withName('query1')
                            .withMulti()
                            .withCurrent(['A', 'C'])
                            .withOptions('A', 'B', 'C')
                            .build();
                        variable = queryBuilder()
                            .withId('query0')
                            .withName('query0')
                            .withMulti()
                            .withCurrent(['A'])
                            .withOptions('A', 'B', 'C')
                            .build();
                        preloadedState = {
                            templating: {
                                variables: (_a = {},
                                    _a[variable.id] = __assign({}, variable),
                                    _a[variableInPickerState.id] = __assign({}, variableInPickerState),
                                    _a),
                                optionsPicker: __assign(__assign({}, initialState), { id: variableInPickerState.id }),
                            },
                        };
                        return [4 /*yield*/, reduxTester({ preloadedState: preloadedState })
                                .givenRootReducer(getRootReducer())
                                .whenAsyncActionIsDispatched(openOptions(variable, undefined))];
                    case 1:
                        tester = _b.sent();
                        tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue({ type: 'query', id: 'query1', data: { option: undefined } }), changeVariableProp({ type: 'query', id: 'query1', data: { propName: 'queryValue', propValue: '' } }), hideOptions(), showOptions(variable));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when commitChangesToVariable is dispatched with no changes', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenAsyncActionIsDispatched(commitChangesToVariable(), true)];
                    case 1:
                        tester = _a.sent();
                        option = __assign(__assign({}, createOption(['A'])), { selected: true, value: ['A'] });
                        tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })), changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })), hideOptions());
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when commitChangesToVariable is dispatched with changes', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = false;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))
                                .whenAsyncActionIsDispatched(commitChangesToVariable(), true)];
                    case 1:
                        tester = _a.sent();
                        option = __assign(__assign({}, createOption([])), { selected: true, value: [] });
                        tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })), changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: '' })), hideOptions(), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': [] });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when commitChangesToVariable is dispatched with changes and list of options is filtered', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A', 'A', true), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = false;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))
                                .whenActionIsDispatched(filterOrSearchOptions('C'))
                                .whenAsyncActionIsDispatched(commitChangesToVariable(), true)];
                    case 1:
                        tester = _a.sent();
                        option = __assign(__assign({}, createOption([])), { selected: true, value: [] });
                        tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload(variable, { option: option })), changeVariableProp(toVariablePayload(variable, { propName: 'queryValue', propValue: 'C' })), hideOptions(), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-Constant': [] });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when toggleOptionByHighlight is dispatched with changes', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, tester, option;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('C')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = false;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(toggleOptionByHighlight(clearOthers), true)];
                    case 1:
                        tester = _a.sent();
                        option = createOption('A');
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: option, forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when toggleOptionByHighlight is dispatched with changes selected from a filtered options list', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, variable, clearOthers, tester, optionA, optionBC;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = [createOption('A'), createOption('B'), createOption('BC'), createOption('BD')];
                        variable = createMultiVariable({ options: options, current: createOption(['A'], ['A'], true), includeAll: false });
                        clearOthers = false;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenActionIsDispatched(showOptions(variable))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(toggleOptionByHighlight(clearOthers), true)
                                .whenActionIsDispatched(filterOrSearchOptions('B'))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(navigateOptions(NavigationKey.moveDown, clearOthers))
                                .whenActionIsDispatched(toggleOptionByHighlight(clearOthers))];
                    case 1:
                        tester = _a.sent();
                        optionA = createOption('A');
                        optionBC = createOption('BD');
                        tester.thenDispatchedActionsShouldEqual(toggleOption({ option: optionA, forceSelect: false, clearOthers: clearOthers }), updateSearchQuery('B'), updateOptionsAndFilter(variable.options), moveOptionsHighlight(1), moveOptionsHighlight(1), toggleOption({ option: optionBC, forceSelect: false, clearOthers: clearOthers }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function createMultiVariable(extend) {
    return __assign(__assign(__assign({}, initialVariableModelState), { type: 'query', id: '0', index: 0, current: createOption([]), options: [], query: 'options-query', name: 'Constant', datasource: 'datasource', definition: '', sort: VariableSort.alphabeticalAsc, refresh: VariableRefresh.never, regex: '', multi: true, includeAll: true }), (extend !== null && extend !== void 0 ? extend : {}));
}
function createOption(text, value, selected) {
    var metric = createMetric(text);
    return __assign(__assign({}, metric), { value: value !== null && value !== void 0 ? value : metric.value, selected: selected !== null && selected !== void 0 ? selected : false });
}
function createMetric(value) {
    return {
        value: value,
        text: value,
    };
}
//# sourceMappingURL=actions.test.js.map