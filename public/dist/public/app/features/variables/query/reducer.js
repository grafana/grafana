import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { isNumber, sortBy, toLower, uniqBy } from 'lodash';
import { stringToJsRegex } from '@grafana/data';
import { initialVariableModelState, VariableRefresh, VariableSort, } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, getInstanceState, initialVariablesState, NONE_VARIABLE_TEXT, NONE_VARIABLE_VALUE, } from '../state/types';
export var initialQueryVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'query', datasource: null, query: '', regex: '', sort: VariableSort.disabled, refresh: VariableRefresh.onDashboardLoad, multi: false, includeAll: false, allValue: null, options: [], current: {}, definition: '' });
export var sortVariableValues = function (options, sortOrder) {
    if (sortOrder === VariableSort.disabled) {
        return options;
    }
    var sortType = Math.ceil(sortOrder / 2);
    var reverseSort = sortOrder % 2 === 0;
    if (sortType === 1) {
        options = sortBy(options, 'text');
    }
    else if (sortType === 2) {
        options = sortBy(options, function (opt) {
            if (!opt.text) {
                return -1;
            }
            var matches = opt.text.match(/.*?(\d+).*/);
            if (!matches || matches.length < 2) {
                return -1;
            }
            else {
                return parseInt(matches[1], 10);
            }
        });
    }
    else if (sortType === 3) {
        options = sortBy(options, function (opt) {
            return toLower(opt.text);
        });
    }
    if (reverseSort) {
        options = options.reverse();
    }
    return options;
};
var getAllMatches = function (str, regex) {
    var results = [];
    var matches = null;
    regex.lastIndex = 0;
    do {
        matches = regex.exec(str);
        if (matches) {
            results.push(matches);
        }
    } while (regex.global && matches && matches[0] !== '' && matches[0] !== undefined);
    return results;
};
export var metricNamesToVariableValues = function (variableRegEx, sort, metricNames) {
    var _a, _b, _c, _d, _e, _f;
    var regex;
    var options = [];
    if (variableRegEx) {
        regex = stringToJsRegex(variableRegEx);
    }
    for (var i = 0; i < metricNames.length; i++) {
        var item = metricNames[i];
        var text = item.text === undefined || item.text === null ? item.value : item.text;
        var value = item.value === undefined || item.value === null ? item.text : item.value;
        if (isNumber(value)) {
            value = value.toString();
        }
        if (isNumber(text)) {
            text = text.toString();
        }
        if (regex) {
            var matches = getAllMatches(value, regex);
            if (!matches.length) {
                continue;
            }
            var valueGroup = matches.find(function (m) { return m.groups && m.groups.value; });
            var textGroup = matches.find(function (m) { return m.groups && m.groups.text; });
            var firstMatch = matches.find(function (m) { return m.length > 1; });
            var manyMatches = matches.length > 1 && firstMatch;
            if (valueGroup || textGroup) {
                value = (_b = (_a = valueGroup === null || valueGroup === void 0 ? void 0 : valueGroup.groups) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : (_c = textGroup === null || textGroup === void 0 ? void 0 : textGroup.groups) === null || _c === void 0 ? void 0 : _c.text;
                text = (_e = (_d = textGroup === null || textGroup === void 0 ? void 0 : textGroup.groups) === null || _d === void 0 ? void 0 : _d.text) !== null && _e !== void 0 ? _e : (_f = valueGroup === null || valueGroup === void 0 ? void 0 : valueGroup.groups) === null || _f === void 0 ? void 0 : _f.value;
            }
            else if (manyMatches) {
                for (var j = 0; j < matches.length; j++) {
                    var match = matches[j];
                    options.push({ text: match[1], value: match[1], selected: false });
                }
                continue;
            }
            else if (firstMatch) {
                text = firstMatch[1];
                value = firstMatch[1];
            }
        }
        options.push({ text: text, value: value, selected: false });
    }
    options = uniqBy(options, 'value');
    return sortVariableValues(options, sort);
};
export var queryVariableSlice = createSlice({
    name: 'templating/query',
    initialState: initialVariablesState,
    reducers: {
        updateVariableOptions: function (state, action) {
            var _a = action.payload.data, results = _a.results, templatedRegex = _a.templatedRegex;
            var instanceState = getInstanceState(state, action.payload.id);
            var includeAll = instanceState.includeAll, sort = instanceState.sort;
            var options = metricNamesToVariableValues(templatedRegex, sort, results);
            if (includeAll) {
                options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
            }
            if (!options.length) {
                options.push({ text: NONE_VARIABLE_TEXT, value: NONE_VARIABLE_VALUE, isNone: true, selected: false });
            }
            instanceState.options = options;
        },
    },
});
export var queryVariableReducer = queryVariableSlice.reducer;
export var updateVariableOptions = queryVariableSlice.actions.updateVariableOptions;
//# sourceMappingURL=reducer.js.map