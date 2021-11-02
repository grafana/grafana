var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { cloneDeep, isString, trim } from 'lodash';
import { ALL_VARIABLE_VALUE } from '../../state/types';
import { isMulti, isQuery } from '../../guard';
import { applyStateChanges } from '../../../../core/utils/applyStateChanges';
import { containsSearchFilter } from '../../utils';
export var initialState = {
    id: '',
    highlightIndex: -1,
    queryValue: '',
    selectedValues: [],
    options: [],
    multi: false,
};
export var OPTIONS_LIMIT = 1000;
var optionsToRecord = function (options) {
    if (!Array.isArray(options)) {
        return {};
    }
    return options.reduce(function (all, option) {
        if (isString(option.value)) {
            all[option.value] = option;
        }
        return all;
    }, {});
};
var updateOptions = function (state) {
    if (!Array.isArray(state.options)) {
        state.options = [];
        return state;
    }
    var selectedOptions = optionsToRecord(state.selectedValues);
    state.selectedValues = Object.values(selectedOptions);
    state.options = state.options.map(function (option) {
        if (!isString(option.value)) {
            return option;
        }
        var selected = !!selectedOptions[option.value];
        if (option.selected === selected) {
            return option;
        }
        return __assign(__assign({}, option), { selected: selected });
    });
    state.options = applyLimit(state.options);
    return state;
};
var applyLimit = function (options) {
    if (!Array.isArray(options)) {
        return [];
    }
    if (options.length <= OPTIONS_LIMIT) {
        return options;
    }
    return options.slice(0, OPTIONS_LIMIT);
};
var updateDefaultSelection = function (state) {
    var options = state.options, selectedValues = state.selectedValues;
    if (options.length === 0 || selectedValues.length > 0) {
        return state;
    }
    if (!options[0] || options[0].value !== ALL_VARIABLE_VALUE) {
        return state;
    }
    state.selectedValues = [__assign(__assign({}, options[0]), { selected: true })];
    return state;
};
var updateAllSelection = function (state) {
    var selectedValues = state.selectedValues;
    if (selectedValues.length > 1) {
        state.selectedValues = selectedValues.filter(function (option) { return option.value !== ALL_VARIABLE_VALUE; });
    }
    return state;
};
var optionsPickerSlice = createSlice({
    name: 'templating/optionsPicker',
    initialState: initialState,
    reducers: {
        showOptions: function (state, action) {
            var _a;
            var _b = action.payload, query = _b.query, options = _b.options;
            state.highlightIndex = -1;
            state.options = cloneDeep(options);
            state.id = action.payload.id;
            state.queryValue = '';
            state.multi = false;
            if (isMulti(action.payload)) {
                state.multi = (_a = action.payload.multi) !== null && _a !== void 0 ? _a : false;
            }
            if (isQuery(action.payload)) {
                var queryValue = action.payload.queryValue;
                var queryHasSearchFilter = containsSearchFilter(query);
                state.queryValue = queryHasSearchFilter && queryValue ? queryValue : '';
            }
            state.selectedValues = state.options.filter(function (option) { return option.selected; });
            return applyStateChanges(state, updateDefaultSelection, updateOptions);
        },
        hideOptions: function (state, action) {
            return __assign({}, initialState);
        },
        toggleOption: function (state, action) {
            var _a = action.payload, option = _a.option, clearOthers = _a.clearOthers, forceSelect = _a.forceSelect;
            var multi = state.multi, selectedValues = state.selectedValues;
            if (option) {
                var selected = !selectedValues.find(function (o) { return o.value === option.value && o.text === option.text; });
                if (option.value === ALL_VARIABLE_VALUE || !multi || clearOthers) {
                    if (selected || forceSelect) {
                        state.selectedValues = [__assign(__assign({}, option), { selected: true })];
                    }
                    else {
                        state.selectedValues = [];
                    }
                    return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
                }
                if (forceSelect || selected) {
                    state.selectedValues.push(__assign(__assign({}, option), { selected: true }));
                    return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
                }
                state.selectedValues = selectedValues.filter(function (o) { return o.value !== option.value && o.text !== option.text; });
            }
            else {
                state.selectedValues = [];
            }
            return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
        },
        moveOptionsHighlight: function (state, action) {
            var nextIndex = state.highlightIndex + action.payload;
            if (nextIndex < 0) {
                nextIndex = 0;
            }
            else if (nextIndex >= state.options.length) {
                nextIndex = state.options.length - 1;
            }
            return __assign(__assign({}, state), { highlightIndex: nextIndex });
        },
        toggleAllOptions: function (state, action) {
            if (state.selectedValues.length > 0) {
                state.selectedValues = [];
                return applyStateChanges(state, updateOptions);
            }
            state.selectedValues = state.options
                .filter(function (option) { return option.value !== ALL_VARIABLE_VALUE; })
                .map(function (option) { return (__assign(__assign({}, option), { selected: true })); });
            return applyStateChanges(state, updateOptions);
        },
        updateSearchQuery: function (state, action) {
            state.queryValue = action.payload;
            return state;
        },
        updateOptionsAndFilter: function (state, action) {
            var _a;
            var searchQuery = trim(((_a = state.queryValue) !== null && _a !== void 0 ? _a : '').toLowerCase());
            state.options = action.payload.filter(function (option) {
                var _a;
                var optionsText = (_a = option.text) !== null && _a !== void 0 ? _a : '';
                var text = Array.isArray(optionsText) ? optionsText.toString() : optionsText;
                return text.toLowerCase().indexOf(searchQuery) !== -1;
            });
            state.highlightIndex = 0;
            return applyStateChanges(state, updateDefaultSelection, updateOptions);
        },
        updateOptionsFromSearch: function (state, action) {
            state.options = action.payload;
            state.highlightIndex = 0;
            return applyStateChanges(state, updateDefaultSelection, updateOptions);
        },
        cleanPickerState: function () { return initialState; },
    },
});
export var toggleOption = (_a = optionsPickerSlice.actions, _a.toggleOption), showOptions = _a.showOptions, hideOptions = _a.hideOptions, moveOptionsHighlight = _a.moveOptionsHighlight, toggleAllOptions = _a.toggleAllOptions, updateSearchQuery = _a.updateSearchQuery, updateOptionsAndFilter = _a.updateOptionsAndFilter, updateOptionsFromSearch = _a.updateOptionsFromSearch, cleanPickerState = _a.cleanPickerState;
export var optionsPickerReducer = optionsPickerSlice.reducer;
//# sourceMappingURL=reducer.js.map