import { isArray, isEqual } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { safeStringifyValue } from 'app/core/utils/explore';
import { getState } from '../../store/store';
import { variableAdapters } from './adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, VARIABLE_PREFIX } from './constants';
import { getVariablesState } from './state/selectors';
import { TransactionStatus, VariableRefresh } from './types';
/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * There are 6 capture groups that replace will return
 * \$(\w+)                                    $var1
 * \[\[(\w+?)(?::(\w+))?\]\]                  [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}   ${var3} or ${var3.fieldPath} or ${var3:fmt3} (or ${var3.fieldPath:fmt3} but that is not a separate capture group)
 */
export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;
// Helper function since lastIndex is not reset
export const variableRegexExec = (variableString) => {
    variableRegex.lastIndex = 0;
    return variableRegex.exec(variableString);
};
export function containsVariable(...args) {
    const variableName = args[args.length - 1];
    args[0] = typeof args[0] === 'string' ? args[0] : safeStringifyValue(args[0]);
    const variableString = args.slice(0, -1).join(' ');
    const matches = variableString.match(variableRegex);
    const isMatchingVariable = matches !== null
        ? matches.find((match) => {
            const varMatch = variableRegexExec(match);
            return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
        : false;
    return !!isMatchingVariable;
}
export const isAllVariable = (variable) => {
    if (!variable) {
        return false;
    }
    if (!variable.current) {
        return false;
    }
    if (variable.current.value) {
        const isArray = Array.isArray(variable.current.value);
        if (isArray && variable.current.value.length && variable.current.value[0] === ALL_VARIABLE_VALUE) {
            return true;
        }
        if (!isArray && variable.current.value === ALL_VARIABLE_VALUE) {
            return true;
        }
    }
    if (variable.current.text) {
        const isArray = Array.isArray(variable.current.text);
        if (isArray && variable.current.text.length && variable.current.text[0] === ALL_VARIABLE_TEXT) {
            return true;
        }
        if (!isArray && variable.current.text === ALL_VARIABLE_TEXT) {
            return true;
        }
    }
    return false;
};
export const getCurrentText = (variable) => {
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
export const getCurrentValue = (variable) => {
    if (!variable || !variable.current || variable.current.value === undefined || variable.current.value === null) {
        return null;
    }
    if (Array.isArray(variable.current.value)) {
        return variable.current.value.toString();
    }
    if (typeof variable.current.value !== 'string') {
        return null;
    }
    return variable.current.value;
};
export function getTemplatedRegex(variable, templateSrv = getTemplateSrv()) {
    if (!variable) {
        return '';
    }
    if (!variable.regex) {
        return '';
    }
    return templateSrv.replace(variable.regex, {}, 'regex');
}
export function getLegacyQueryOptions(variable, searchFilter, timeSrv, scopedVars) {
    const queryOptions = { range: undefined, variable, searchFilter, scopedVars };
    if (variable.refresh === VariableRefresh.onTimeRangeChanged || variable.refresh === VariableRefresh.onDashboardLoad) {
        queryOptions.range = timeSrv.timeRange();
    }
    return queryOptions;
}
export function getVariableRefresh(variable) {
    if (!variable || !variable.hasOwnProperty('refresh')) {
        return VariableRefresh.never;
    }
    const queryVariable = variable;
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
        .filter((v) => v.id !== 'system')
        .map(({ id, name, description }) => ({
        label: name,
        value: id,
        description,
    }));
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
    let count = 0;
    const changes = {};
    for (const key in query) {
        if (!key.startsWith(VARIABLE_PREFIX)) {
            continue;
        }
        let oldValue = getUrlValueForComparison(old[key]);
        let newValue = getUrlValueForComparison(query[key]);
        if (!isEqual(newValue, oldValue)) {
            changes[key] = { value: query[key] };
            count++;
        }
    }
    for (const key in old) {
        if (!key.startsWith(VARIABLE_PREFIX)) {
            continue;
        }
        const value = old[key];
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
export function hasOngoingTransaction(key, state = getState()) {
    return getVariablesState(key, state).transaction.status !== TransactionStatus.NotStarted;
}
export function toStateKey(key) {
    return String(key);
}
export const toKeyedVariableIdentifier = (variable) => {
    if (!variable.rootStateKey) {
        throw new Error(`rootStateKey not found for variable with id:${variable.id}`);
    }
    return { type: variable.type, id: variable.id, rootStateKey: variable.rootStateKey };
};
export function toVariablePayload(obj, data) {
    return { type: obj.type, id: obj.id, data: data };
}
//# sourceMappingURL=utils.js.map