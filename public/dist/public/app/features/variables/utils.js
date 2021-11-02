import { isArray, isEqual } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from './state/types';
import { VariableRefresh } from './types';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { variableAdapters } from './adapters';
import { safeStringifyValue } from 'app/core/utils/explore';
/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export var variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;
// Helper function since lastIndex is not reset
export var variableRegexExec = function (variableString) {
    variableRegex.lastIndex = 0;
    return variableRegex.exec(variableString);
};
export var SEARCH_FILTER_VARIABLE = '__searchFilter';
export var containsSearchFilter = function (query) {
    return query && typeof query === 'string' ? query.indexOf(SEARCH_FILTER_VARIABLE) !== -1 : false;
};
export var getSearchFilterScopedVar = function (args) {
    var query = args.query, wildcardChar = args.wildcardChar;
    if (!containsSearchFilter(query)) {
        return {};
    }
    var options = args.options;
    options = options || { searchFilter: '' };
    var value = options.searchFilter ? "" + options.searchFilter + wildcardChar : "" + wildcardChar;
    return {
        __searchFilter: {
            value: value,
            text: '',
        },
    };
};
export function containsVariable() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var variableName = args[args.length - 1];
    args[0] = typeof args[0] === 'string' ? args[0] : safeStringifyValue(args[0]);
    var variableString = args.slice(0, -1).join(' ');
    var matches = variableString.match(variableRegex);
    var isMatchingVariable = matches !== null
        ? matches.find(function (match) {
            var varMatch = variableRegexExec(match);
            return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
        : false;
    return !!isMatchingVariable;
}
export var isAllVariable = function (variable) {
    if (!variable) {
        return false;
    }
    if (!variable.current) {
        return false;
    }
    if (variable.current.value) {
        var isArray_1 = Array.isArray(variable.current.value);
        if (isArray_1 && variable.current.value.length && variable.current.value[0] === ALL_VARIABLE_VALUE) {
            return true;
        }
        if (!isArray_1 && variable.current.value === ALL_VARIABLE_VALUE) {
            return true;
        }
    }
    if (variable.current.text) {
        var isArray_2 = Array.isArray(variable.current.text);
        if (isArray_2 && variable.current.text.length && variable.current.text[0] === ALL_VARIABLE_TEXT) {
            return true;
        }
        if (!isArray_2 && variable.current.text === ALL_VARIABLE_TEXT) {
            return true;
        }
    }
    return false;
};
export var getCurrentText = function (variable) {
    if (!variable) {
        return '';
    }
    if (!variable.current) {
        return '';
    }
    if (!variable.current.text) {
        return '';
    }
    if (Array.isArray(variable.current.text)) {
        return variable.current.text.toString();
    }
    if (typeof variable.current.text !== 'string') {
        return '';
    }
    return variable.current.text;
};
export function getTemplatedRegex(variable, templateSrv) {
    if (templateSrv === void 0) { templateSrv = getTemplateSrv(); }
    if (!variable) {
        return '';
    }
    if (!variable.regex) {
        return '';
    }
    return templateSrv.replace(variable.regex, {}, 'regex');
}
export function getLegacyQueryOptions(variable, searchFilter, timeSrv) {
    if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
    var queryOptions = { range: undefined, variable: variable, searchFilter: searchFilter };
    if (variable.refresh === VariableRefresh.onTimeRangeChanged || variable.refresh === VariableRefresh.onDashboardLoad) {
        queryOptions.range = timeSrv.timeRange();
    }
    return queryOptions;
}
export function getVariableRefresh(variable) {
    if (!variable || !variable.hasOwnProperty('refresh')) {
        return VariableRefresh.never;
    }
    var queryVariable = variable;
    if (queryVariable.refresh !== VariableRefresh.onTimeRangeChanged &&
        queryVariable.refresh !== VariableRefresh.onDashboardLoad &&
        queryVariable.refresh !== VariableRefresh.never) {
        return VariableRefresh.never;
    }
    return queryVariable.refresh;
}
export function getVariableTypes() {
    return variableAdapters
        .list()
        .filter(function (v) { return v.id !== 'system'; })
        .map(function (_a) {
        var id = _a.id, name = _a.name;
        return ({
            label: name,
            value: id,
        });
    });
}
function getUrlValueForComparison(value) {
    if (isArray(value)) {
        if (value.length === 0) {
            value = undefined;
        }
        else if (value.length === 1) {
            value = value[0];
        }
    }
    return value;
}
export function findTemplateVarChanges(query, old) {
    var count = 0;
    var changes = {};
    for (var key in query) {
        if (!key.startsWith('var-')) {
            continue;
        }
        var oldValue = getUrlValueForComparison(old[key]);
        var newValue = getUrlValueForComparison(query[key]);
        if (!isEqual(newValue, oldValue)) {
            changes[key] = { value: query[key] };
            count++;
        }
    }
    for (var key in old) {
        if (!key.startsWith('var-')) {
            continue;
        }
        var value = old[key];
        // ignore empty array values
        if (isArray(value) && value.length === 0) {
            continue;
        }
        if (!query.hasOwnProperty(key)) {
            changes[key] = { value: '', removed: true }; // removed
            count++;
        }
    }
    return count ? changes : undefined;
}
export function ensureStringValues(value) {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number') {
        return value.toString(10);
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value.toString();
    }
    return '';
}
//# sourceMappingURL=utils.js.map