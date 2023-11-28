import { createSlice } from '@reduxjs/toolkit';
import { isNumber, sortBy, toLower, uniqBy } from 'lodash';
import { stringToJsRegex } from '@grafana/data';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, NONE_VARIABLE_TEXT, NONE_VARIABLE_VALUE } from '../constants';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState, VariableRefresh, VariableSort } from '../types';
export const initialQueryVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'query', datasource: null, query: '', regex: '', sort: VariableSort.disabled, refresh: VariableRefresh.onDashboardLoad, multi: false, includeAll: false, allValue: null, options: [], current: {}, definition: '' });
export const sortVariableValues = (options, sortOrder) => {
    if (sortOrder === VariableSort.disabled) {
        return options;
    }
    const sortType = Math.ceil(sortOrder / 2);
    const reverseSort = sortOrder % 2 === 0;
    if (sortType === 1) {
        options = sortBy(options, 'text');
    }
    else if (sortType === 2) {
        options = sortBy(options, (opt) => {
            if (!opt.text) {
                return -1;
            }
            const matches = opt.text.match(/.*?(\d+).*/);
            if (!matches || matches.length < 2) {
                return -1;
            }
            else {
                return parseInt(matches[1], 10);
            }
        });
    }
    else if (sortType === 3) {
        options = sortBy(options, (opt) => {
            return toLower(opt.text);
        });
    }
    if (reverseSort) {
        options = options.reverse();
    }
    return options;
};
const getAllMatches = (str, regex) => {
    const results = [];
    let matches = null;
    regex.lastIndex = 0;
    do {
        matches = regex.exec(str);
        if (matches) {
            results.push(matches);
        }
    } while (regex.global && matches && matches[0] !== '' && matches[0] !== undefined);
    return results;
};
export const metricNamesToVariableValues = (variableRegEx, sort, metricNames) => {
    var _a, _b, _c, _d, _e, _f;
    let regex;
    let options = [];
    if (variableRegEx) {
        regex = stringToJsRegex(variableRegEx);
    }
    for (let i = 0; i < metricNames.length; i++) {
        const item = metricNames[i];
        let text = item.text === undefined || item.text === null ? item.value : item.text;
        let value = item.value === undefined || item.value === null ? item.text : item.value;
        if (isNumber(value)) {
            value = value.toString();
        }
        if (isNumber(text)) {
            text = text.toString();
        }
        if (regex) {
            const matches = getAllMatches(value, regex);
            if (!matches.length) {
                continue;
            }
            const valueGroup = matches.find((m) => m.groups && m.groups.value);
            const textGroup = matches.find((m) => m.groups && m.groups.text);
            const firstMatch = matches.find((m) => m.length > 1);
            const manyMatches = matches.length > 1 && firstMatch;
            if (valueGroup || textGroup) {
                value = (_b = (_a = valueGroup === null || valueGroup === void 0 ? void 0 : valueGroup.groups) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : (_c = textGroup === null || textGroup === void 0 ? void 0 : textGroup.groups) === null || _c === void 0 ? void 0 : _c.text;
                text = (_e = (_d = textGroup === null || textGroup === void 0 ? void 0 : textGroup.groups) === null || _d === void 0 ? void 0 : _d.text) !== null && _e !== void 0 ? _e : (_f = valueGroup === null || valueGroup === void 0 ? void 0 : valueGroup.groups) === null || _f === void 0 ? void 0 : _f.value;
            }
            else if (manyMatches) {
                for (let j = 0; j < matches.length; j++) {
                    const match = matches[j];
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
export const queryVariableSlice = createSlice({
    name: 'templating/query',
    initialState: initialVariablesState,
    reducers: {
        updateVariableOptions: (state, action) => {
            const { results, templatedRegex } = action.payload.data;
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'query') {
                return;
            }
            const { includeAll, sort } = instanceState;
            const options = metricNamesToVariableValues(templatedRegex, sort, results);
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
export const queryVariableReducer = queryVariableSlice.reducer;
export const { updateVariableOptions } = queryVariableSlice.actions;
//# sourceMappingURL=reducer.js.map