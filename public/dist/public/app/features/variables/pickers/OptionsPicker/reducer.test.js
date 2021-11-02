import { __assign, __makeTemplateObject } from "tslib";
import { cloneDeep } from 'lodash';
import { cleanPickerState, hideOptions, initialState as optionsPickerInitialState, moveOptionsHighlight, OPTIONS_LIMIT, optionsPickerReducer, showOptions, toggleAllOptions, toggleOption, updateOptionsAndFilter, updateOptionsFromSearch, updateSearchQuery, } from './reducer';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../../state/types';
var getVariableTestContext = function (extend) {
    return {
        initialState: __assign(__assign({}, optionsPickerInitialState), extend),
    };
};
describe('optionsPickerReducer', function () {
    describe('when toggleOption is dispatched', function () {
        var opsAll = [
            { text: '$__all', value: '$__all', selected: true },
            { text: 'A', value: 'A', selected: false },
            { text: 'B', value: 'B', selected: false },
        ];
        var opsA = [
            { text: '$__all', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: false },
        ];
        var opsAB = [
            { text: '$__all', value: '$__all', selected: false },
            { text: 'A', value: 'A', selected: true },
            { text: 'B', value: 'B', selected: true },
        ];
        var expectToggleOptionState = function (args) {
            var initialState = getVariableTestContext({
                options: args.options,
                multi: args.multi,
                selectedValues: args.options.filter(function (o) { return o.selected; }),
            }).initialState;
            var payload = {
                forceSelect: args.forceSelect,
                clearOthers: args.clearOthers,
                option: { text: args.option, value: args.option, selected: true },
            };
            var expectedAsRecord = args.expectSelected.reduce(function (all, current) {
                all[current] = current;
                return all;
            }, {});
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleOption(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { selectedValues: args.expectSelected.map(function (value) { return ({ value: value, text: value, selected: true }); }), options: args.options.map(function (option) {
                    return __assign(__assign({}, option), { selected: !!expectedAsRecord[option.value] });
                }) }));
        };
        describe('When toggleOption with undefined option is dispatched', function () {
            it('should update selected values', function () {
                var initialState = getVariableTestContext({
                    options: [],
                    selectedValues: [],
                }).initialState;
                var payload = {
                    forceSelect: false,
                    clearOthers: true,
                    option: undefined,
                };
                reducerTester()
                    .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(toggleOption(payload))
                    .thenStateShouldEqual(__assign(__assign({}, initialState), { selectedValues: [], options: [] }));
            });
        });
        describe('toggleOption for multi value variable', function () {
            var multi = true;
            describe('and value All is selected in options', function () {
                var options = opsAll;
                it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          option      | forceSelect | clearOthers | expectSelected\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "], ["\n          option      | forceSelect | clearOthers | expectSelected\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "])), 'A', true, false, ['A'], 'A', false, false, ['A'], 'A', true, true, ['A'], 'A', false, true, ['A'], 'B', true, false, ['B'], 'B', false, false, ['B'], 'B', true, true, ['B'], 'B', false, true, ['B'], '$__all', true, false, ['$__all'], '$__all', false, false, ['$__all'], '$__all', true, true, ['$__all'], '$__all', false, true, ['$__all'])('and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected', function (_a) {
                    var option = _a.option, forceSelect = _a.forceSelect, clearOthers = _a.clearOthers, expectSelected = _a.expectSelected;
                    return expectToggleOptionState({
                        options: options,
                        multi: multi,
                        option: option,
                        clearOthers: clearOthers,
                        forceSelect: forceSelect,
                        expectSelected: expectSelected,
                    });
                });
            });
            describe('and value A is selected in options', function () {
                var options = opsA;
                it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n        "], ["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n        "])), 'A', true, false, ['A'], 'A', false, false, ['$__all'], 'A', true, true, ['A'], 'A', false, true, ['$__all'], 'B', true, true, ['B'], 'B', false, true, ['B'], 'B', true, false, ['A', 'B'], 'B', false, false, ['A', 'B'])('and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected', function (_a) {
                    var option = _a.option, forceSelect = _a.forceSelect, clearOthers = _a.clearOthers, expectSelected = _a.expectSelected;
                    return expectToggleOptionState({
                        options: options,
                        multi: multi,
                        option: option,
                        clearOthers: clearOthers,
                        forceSelect: forceSelect,
                        expectSelected: expectSelected,
                    });
                });
            });
            describe('and values A + B is selected in options', function () {
                var options = opsAB;
                it.each(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n        "], ["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n        "])), 'A', true, false, ['A', 'B'], 'A', false, false, ['B'], 'A', true, true, ['A'], 'A', false, true, ['$__all'], 'B', true, true, ['B'], 'B', false, true, ['$__all'], 'B', true, false, ['A', 'B'], 'B', false, false, ['A'])('and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected', function (_a) {
                    var option = _a.option, forceSelect = _a.forceSelect, clearOthers = _a.clearOthers, expectSelected = _a.expectSelected;
                    return expectToggleOptionState({
                        options: options,
                        multi: multi,
                        option: option,
                        clearOthers: clearOthers,
                        forceSelect: forceSelect,
                        expectSelected: expectSelected,
                    });
                });
            });
        });
        describe('toggleOption for single value variable', function () {
            var multi = false;
            describe('and value All is selected in options', function () {
                var options = opsAll;
                it.each(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n          option      | forceSelect | clearOthers | expectSelected\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "], ["\n          option      | forceSelect | clearOthers | expectSelected\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", "      | ", "     | ", "    | ", "\n          ", "      | ", "    | ", "    | ", "\n          ", "      | ", "     | ", "     | ", "\n          ", "      | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "])), 'A', true, false, ['A'], 'A', false, false, ['A'], 'A', true, true, ['A'], 'A', false, true, ['A'], 'B', true, false, ['B'], 'B', false, false, ['B'], 'B', true, true, ['B'], 'B', false, true, ['B'], '$__all', true, false, ['$__all'], '$__all', false, false, ['$__all'], '$__all', true, true, ['$__all'], '$__all', false, true, ['$__all'])('and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected', function (_a) {
                    var option = _a.option, forceSelect = _a.forceSelect, clearOthers = _a.clearOthers, expectSelected = _a.expectSelected;
                    return expectToggleOptionState({
                        options: options,
                        multi: multi,
                        option: option,
                        clearOthers: clearOthers,
                        forceSelect: forceSelect,
                        expectSelected: expectSelected,
                    });
                });
            });
            describe('and value A is selected in options', function () {
                var options = opsA;
                it.each(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "], ["\n          option | forceSelect | clearOthers | expectSelected\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n          ", " | ", "     | ", "    | ", "\n          ", " | ", "    | ", "    | ", "\n          ", " | ", "     | ", "     | ", "\n          ", " | ", "    | ", "     | ", "\n        "])), 'A', true, false, ['A'], 'A', false, false, ['$__all'], 'A', true, true, ['A'], 'A', false, true, ['$__all'], 'B', true, false, ['B'], 'B', false, false, ['B'], 'B', true, true, ['B'], 'B', false, true, ['B'])('and we toggle $option with options: { forceSelect: $forceSelect, clearOthers: $clearOthers } we expect $expectSelected to be selected', function (_a) {
                    var option = _a.option, forceSelect = _a.forceSelect, clearOthers = _a.clearOthers, expectSelected = _a.expectSelected;
                    return expectToggleOptionState({
                        options: options,
                        multi: multi,
                        option: option,
                        clearOthers: clearOthers,
                        forceSelect: forceSelect,
                        expectSelected: expectSelected,
                    });
                });
            });
        });
    });
    describe('when showOptions is dispatched', function () {
        it('then correct values should be selected', function () {
            var initialState = getVariableTestContext({}).initialState;
            var payload = {
                type: 'query',
                query: '',
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ],
                multi: false,
                id: '0',
            };
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(showOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: payload.options, id: payload.id, multi: payload.multi, selectedValues: [{ text: 'B', value: 'B', selected: true }], queryValue: '' }));
        });
    });
    describe('when showOptions is dispatched and picker has queryValue and variable has searchFilter', function () {
        it('then state should be correct', function () {
            var query = '*.__searchFilter';
            var queryValue = 'a search query';
            var selected = { text: 'All', value: '$__all', selected: true };
            var initialState = getVariableTestContext({}).initialState;
            var payload = {
                type: 'query',
                query: query,
                options: [selected, { text: 'A', value: 'A', selected: false }, { text: 'B', value: 'B', selected: false }],
                multi: false,
                id: '0',
                queryValue: queryValue,
            };
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(showOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: payload.options, queryValue: queryValue, id: payload.id, multi: payload.multi, selectedValues: [selected] }));
        });
    });
    describe('when showOptions is dispatched and queryValue and variable has no searchFilter', function () {
        it('then state should be correct', function () {
            var query = '*.';
            var queryValue = null;
            var current = { text: ALL_VARIABLE_TEXT, selected: true, value: [ALL_VARIABLE_VALUE] };
            var options = [
                { text: 'All', value: '$__all', selected: true },
                { text: 'A', value: 'A', selected: false },
                { text: 'B', value: 'B', selected: false },
            ];
            var initialState = getVariableTestContext({}).initialState;
            var payload = { type: 'query', id: '0', current: current, query: query, options: options, queryValue: queryValue };
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(showOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { id: '0', queryValue: '', selectedValues: [
                    {
                        text: ALL_VARIABLE_TEXT,
                        selected: true,
                        value: ALL_VARIABLE_VALUE,
                    },
                ], options: options }));
        });
    });
    describe('when hideOptions is dispatched', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({
                options: [
                    { text: 'All', value: '$__all', selected: true },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
                queryValue: 'a search',
                highlightIndex: 1,
                id: '0',
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(hideOptions())
                .thenStateShouldEqual(__assign({}, optionsPickerInitialState));
        });
    });
    describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 0', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({ highlightIndex: 0 }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(moveOptionsHighlight(-1))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { highlightIndex: 0 }));
        });
    });
    describe('when changeQueryVariableHighlightIndex is dispatched with -1 and highlightIndex is 1', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({
                highlightIndex: 1,
                options: [
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(moveOptionsHighlight(-1))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { highlightIndex: 0 }));
        });
    });
    describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is same as options.length', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({
                highlightIndex: 1,
                options: [
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(moveOptionsHighlight(1))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { highlightIndex: 1 }));
        });
    });
    describe('when changeQueryVariableHighlightIndex is dispatched with 1 and highlightIndex is below options.length', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({
                highlightIndex: 0,
                options: [
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(moveOptionsHighlight(1))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { highlightIndex: 1 }));
        });
    });
    describe('when toggleAllOptions is dispatched', function () {
        it('should toggle all values except All to true', function () {
            var initialState = getVariableTestContext({
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
                selectedValues: [],
                multi: true,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleAllOptions())
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: true },
                    { text: 'B', value: 'B', selected: true },
                ], selectedValues: [
                    { text: 'A', value: 'A', selected: true },
                    { text: 'B', value: 'B', selected: true },
                ] }));
        });
        it('should toggle all values to false when $_all is selected', function () {
            var initialState = getVariableTestContext({
                options: [
                    { text: 'All', value: '$__all', selected: true },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ],
                selectedValues: [{ text: 'All', value: '$__all', selected: true }],
                multi: true,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleAllOptions())
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ], selectedValues: [] }));
        });
        it('should toggle all values to false when a option is selected', function () {
            var initialState = getVariableTestContext({
                options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ],
                selectedValues: [{ text: 'B', value: 'B', selected: true }],
                multi: true,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleAllOptions())
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ], selectedValues: [] }));
        });
    });
    describe('when updateOptionsAndFilter is dispatched and queryValue exists', function () {
        it('then state should be correct', function () {
            var queryValue = 'A';
            var options = [
                { text: 'All', value: '$__all', selected: true },
                { text: 'A', value: 'A', selected: false },
                { text: 'B', value: 'B', selected: false },
            ];
            var initialState = getVariableTestContext({ queryValue: queryValue }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateOptionsAndFilter(options))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: true },
                    { text: 'A', value: 'A', selected: false },
                ], selectedValues: [{ text: 'All', value: '$__all', selected: true }], queryValue: 'A', highlightIndex: 0 }));
        });
        describe('but option is null', function () {
            it('then state should be correct', function () {
                var queryValue = 'A';
                var options = [
                    { text: 'All', value: '$__all', selected: true },
                    { text: null, value: null, selected: false },
                    { text: [null], value: [null], selected: false },
                ];
                var initialState = getVariableTestContext({ queryValue: queryValue }).initialState;
                reducerTester()
                    .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(updateOptionsAndFilter(options))
                    .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [{ text: 'All', value: '$__all', selected: true }], selectedValues: [{ text: 'All', value: '$__all', selected: true }], queryValue: 'A', highlightIndex: 0 }));
            });
        });
        describe('and option count is are greater then OPTIONS_LIMIT', function () {
            it('then state should be correct', function () {
                var queryValue = 'option:1337';
                var options = [];
                for (var index = 0; index <= OPTIONS_LIMIT + 337; index++) {
                    options.push({ text: "option:" + index, value: "option:" + index, selected: false });
                }
                var initialState = getVariableTestContext({ queryValue: queryValue }).initialState;
                reducerTester()
                    .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(updateOptionsAndFilter(options))
                    .thenStateShouldEqual(__assign(__assign({}, cloneDeep(initialState)), { options: [{ text: 'option:1337', value: 'option:1337', selected: false }], selectedValues: [], queryValue: 'option:1337', highlightIndex: 0 }));
            });
        });
    });
    describe('when value is selected and filter is applied but then removed', function () {
        it('then state should be correct', function () {
            var queryValue = 'A';
            var options = [
                { text: 'All', value: '$__all', selected: false },
                { text: 'A', value: 'A', selected: false },
                { text: 'B', value: 'B', selected: false },
            ];
            var initialState = getVariableTestContext({
                options: options,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleOption({ option: options[2], forceSelect: false, clearOthers: false }))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }] }))
                .whenActionIsDispatched(updateSearchQuery(queryValue))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }], queryValue: 'A' }))
                .whenActionIsDispatched(updateOptionsAndFilter(options))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }], queryValue: 'A', highlightIndex: 0 }))
                .whenActionIsDispatched(updateSearchQuery(''))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }], queryValue: '', highlightIndex: 0 }))
                .whenActionIsDispatched(updateOptionsAndFilter(options))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }], queryValue: '', highlightIndex: 0 }));
        });
    });
    describe('when value is toggled back and forth', function () {
        it('then state should be correct', function () {
            var options = [
                { text: 'All', value: '$__all', selected: false },
                { text: 'A', value: 'A', selected: false },
                { text: 'B', value: 'B', selected: false },
            ];
            var toggleOptionAction = toggleOption({
                option: options[2],
                forceSelect: false,
                clearOthers: false,
            });
            var initialState = getVariableTestContext({
                options: options,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(toggleOptionAction)
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: false },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: true },
                ], selectedValues: [{ text: 'B', value: 'B', selected: true }] }))
                .whenActionIsDispatched(toggleOptionAction)
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: [
                    { text: 'All', value: '$__all', selected: true },
                    { text: 'A', value: 'A', selected: false },
                    { text: 'B', value: 'B', selected: false },
                ], selectedValues: [{ text: 'All', value: '$__all', selected: true }] }));
        });
    });
    describe('when updateOptionsFromSearch is dispatched and variable has searchFilter', function () {
        it('then state should be correct', function () {
            var searchQuery = '__searchFilter';
            var options = [
                { text: 'All', value: '$__all', selected: true },
                { text: 'A', value: 'A', selected: false },
                { text: 'B', value: 'B', selected: false },
            ];
            var initialState = getVariableTestContext({
                queryValue: searchQuery,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateOptionsFromSearch(options))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: options, selectedValues: [{ text: 'All', value: '$__all', selected: true }], highlightIndex: 0 }));
        });
    });
    describe('when updateSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            var searchQuery = 'A';
            var initialState = getVariableTestContext({}).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateSearchQuery(searchQuery))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { queryValue: searchQuery }));
        });
    });
    describe('when large data for updateOptionsAndFilter', function () {
        it('then state should be correct', function () {
            var searchQuery = 'option:11256';
            var options = [];
            for (var index = 0; index <= OPTIONS_LIMIT + 11256; index++) {
                options.push({ text: "option:" + index, value: "option:" + index, selected: false });
            }
            var initialState = getVariableTestContext({
                queryValue: searchQuery,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateOptionsAndFilter(options))
                .thenStateShouldEqual(__assign(__assign({}, cloneDeep(initialState)), { options: [{ text: 'option:11256', value: 'option:11256', selected: false }], selectedValues: [], queryValue: 'option:11256', highlightIndex: 0 }));
        });
    });
    describe('when large data for updateOptionsFromSearch is dispatched and variable has searchFilter', function () {
        it('then state should be correct', function () {
            var searchQuery = '__searchFilter';
            var options = [{ text: 'All', value: '$__all', selected: true }];
            for (var i = 0; i <= OPTIONS_LIMIT + 137; i++) {
                options.push({ text: "option" + i, value: "option" + i, selected: false });
            }
            var initialState = getVariableTestContext({
                queryValue: searchQuery,
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateOptionsFromSearch(options))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: options.slice(0, OPTIONS_LIMIT), selectedValues: [{ text: 'All', value: '$__all', selected: true }], highlightIndex: 0 }));
        });
    });
    describe('when large data for showOptions', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({}).initialState;
            var payload = {
                type: 'query',
                query: '',
                options: [{ text: 'option0', value: 'option0', selected: false }],
                multi: false,
                id: '0',
            };
            var checkOptions = [];
            for (var index = 0; index < OPTIONS_LIMIT; index++) {
                checkOptions.push({ text: "option" + index, value: "option" + index, selected: false });
            }
            for (var i = 1; i <= OPTIONS_LIMIT + 137; i++) {
                payload.options.push({ text: "option" + i, value: "option" + i, selected: false });
            }
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(showOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { options: checkOptions, id: '0', multi: false, queryValue: '' }));
        });
    });
    describe('when cleanPickerState is dispatched', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext({
                highlightIndex: 19,
                multi: true,
                id: 'some id',
                options: [{ text: 'A', value: 'A', selected: true }],
                queryValue: 'a query value',
                selectedValues: [{ text: 'A', value: 'A', selected: true }],
            }).initialState;
            reducerTester()
                .givenReducer(optionsPickerReducer, cloneDeep(initialState))
                .whenActionIsDispatched(cleanPickerState())
                .thenStateShouldEqual(__assign({}, optionsPickerInitialState));
        });
    });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=reducer.test.js.map