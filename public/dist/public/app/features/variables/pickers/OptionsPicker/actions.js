import { __awaiter } from "tslib";
import { debounce, trim } from 'lodash';
import { isEmptyObject, containsSearchFilter } from '@grafana/data';
import { variableAdapters } from '../../adapters';
import { hasOptions } from '../../guard';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../../state/selectors';
import { changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { getCurrentValue, toVariablePayload } from '../../utils';
import { NavigationKey } from '../types';
import { hideOptions, moveOptionsHighlight, showOptions, toggleOption, updateOptionsAndFilter, updateOptionsFromSearch, updateSearchQuery, } from './reducer';
export const navigateOptions = (rootStateKey, key, clearOthers) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        if (key === NavigationKey.cancel) {
            return yield dispatch(commitChangesToVariable(rootStateKey));
        }
        if (key === NavigationKey.select) {
            return dispatch(toggleOptionByHighlight(rootStateKey, clearOthers));
        }
        if (key === NavigationKey.selectAndClose) {
            const picker = getVariablesState(rootStateKey, getState()).optionsPicker;
            if (picker.multi) {
                return dispatch(toggleOptionByHighlight(rootStateKey, clearOthers));
            }
            dispatch(toggleOptionByHighlight(rootStateKey, clearOthers, true));
            return dispatch(commitChangesToVariable(rootStateKey));
        }
        if (key === NavigationKey.moveDown) {
            return dispatch(toKeyedAction(rootStateKey, moveOptionsHighlight(1)));
        }
        if (key === NavigationKey.moveUp) {
            return dispatch(toKeyedAction(rootStateKey, moveOptionsHighlight(-1)));
        }
        return undefined;
    });
};
export const filterOrSearchOptions = (passedIdentifier, searchQuery = '') => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const { rootStateKey } = passedIdentifier;
        const { id, queryValue } = getVariablesState(rootStateKey, getState()).optionsPicker;
        const identifier = { id, rootStateKey: rootStateKey, type: 'query' };
        const variable = getVariable(identifier, getState());
        if (!('options' in variable)) {
            return;
        }
        dispatch(toKeyedAction(rootStateKey, updateSearchQuery(searchQuery)));
        if (trim(queryValue) === trim(searchQuery)) {
            return;
        }
        const { query, options } = variable;
        const queryTarget = typeof query === 'string' ? query : query.target;
        if (containsSearchFilter(queryTarget)) {
            return searchForOptionsWithDebounce(dispatch, getState, searchQuery, rootStateKey);
        }
        return dispatch(toKeyedAction(rootStateKey, updateOptionsAndFilter(options)));
    });
};
const setVariable = (updated) => __awaiter(void 0, void 0, void 0, function* () {
    if (isEmptyObject(updated.current)) {
        return;
    }
    const adapter = variableAdapters.get(updated.type);
    yield adapter.setValue(updated, updated.current, true);
    return;
});
export const commitChangesToVariable = (key, callback) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const picker = getVariablesState(key, getState()).optionsPicker;
        const identifier = { id: picker.id, rootStateKey: key, type: 'query' };
        const existing = getVariable(identifier, getState());
        if (!hasOptions(existing)) {
            return;
        }
        const currentPayload = { option: mapToCurrent(picker) };
        const searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };
        dispatch(toKeyedAction(key, setCurrentVariableValue(toVariablePayload(existing, currentPayload))));
        dispatch(toKeyedAction(key, changeVariableProp(toVariablePayload(existing, searchQueryPayload))));
        const updated = getVariable(identifier, getState());
        if (!hasOptions(updated)) {
            return;
        }
        dispatch(toKeyedAction(key, hideOptions()));
        if (getCurrentValue(existing) === getCurrentValue(updated)) {
            return;
        }
        if (callback) {
            return callback(updated);
        }
        return yield setVariable(updated);
    });
};
export const openOptions = (identifier, callback) => (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, rootStateKey: uid } = identifier;
    const picker = getVariablesState(uid, getState()).optionsPicker;
    if (picker.id && picker.id !== id) {
        yield dispatch(commitChangesToVariable(uid, callback));
    }
    const variable = getVariable(identifier, getState());
    if (!hasOptions(variable)) {
        return;
    }
    dispatch(toKeyedAction(uid, showOptions(variable)));
});
export const toggleOptionByHighlight = (key, clearOthers, forceSelect = false) => {
    return (dispatch, getState) => {
        const { highlightIndex, options } = getVariablesState(key, getState()).optionsPicker;
        const option = options[highlightIndex];
        dispatch(toKeyedAction(key, toggleOption({ option, forceSelect, clearOthers })));
    };
};
const searchForOptions = (dispatch, getState, searchQuery, key) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = getVariablesState(key, getState()).optionsPicker;
        const identifier = { id, rootStateKey: key, type: 'query' };
        const existing = getVariable(identifier, getState());
        if (!hasOptions(existing)) {
            return;
        }
        const adapter = variableAdapters.get(existing.type);
        yield adapter.updateOptions(existing, searchQuery);
        const updated = getVariable(identifier, getState());
        if (!hasOptions(updated)) {
            return;
        }
        dispatch(toKeyedAction(key, updateOptionsFromSearch(updated.options)));
    }
    catch (error) {
        console.error(error);
    }
});
const searchForOptionsWithDebounce = debounce(searchForOptions, 500);
export function mapToCurrent(picker) {
    const { options, selectedValues, queryValue: searchQuery, multi } = picker;
    if (options.length === 0 && searchQuery && searchQuery.length > 0) {
        return { text: searchQuery, value: searchQuery, selected: false };
    }
    if (!multi) {
        return selectedValues.find((o) => o.selected);
    }
    const texts = [];
    const values = [];
    for (const option of selectedValues) {
        if (!option.selected) {
            continue;
        }
        texts.push(option.text.toString());
        values.push(option.value.toString());
    }
    return {
        value: values,
        text: texts,
        selected: true,
    };
}
//# sourceMappingURL=actions.js.map