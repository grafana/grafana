import memoizeOne from 'memoize-one';
import { getState } from '../../../store/store';
import { toStateKey } from '../utils';
import { getInitialTemplatingState } from './reducers';
export function getVariable(identifier, state = getState(), throwWhenMissing = true) {
    const { id, rootStateKey } = identifier;
    const variablesState = getVariablesState(rootStateKey, state);
    const variable = variablesState.variables[id];
    if (!variable) {
        if (throwWhenMissing) {
            throw new Error(`Couldn't find variable with id:${id}`);
        }
        return undefined;
    }
    return variable;
}
function getFilteredVariablesByKey(filter, key, state = getState()) {
    return Object.values(getVariablesState(key, state).variables)
        .filter(filter)
        .sort((s1, s2) => s1.index - s2.index);
}
export function getVariablesState(key, state = getState()) {
    var _a;
    return (_a = state.templating.keys[toStateKey(key)]) !== null && _a !== void 0 ? _a : getInitialTemplatingState();
}
export function getVariablesByKey(key, state = getState()) {
    return getFilteredVariablesByKey(defaultVariablesFilter, key, state);
}
function defaultVariablesFilter(variable) {
    return variable.type !== 'system';
}
export const getSubMenuVariables = memoizeOne((key, variables) => {
    return getVariablesByKey(key, getState());
});
export const getEditorVariables = (key, state) => {
    return getVariablesByKey(key, state);
};
export function getNewVariableIndex(key, state = getState()) {
    return getNextVariableIndex(Object.values(getVariablesState(key, state).variables));
}
export function getNextVariableIndex(variables) {
    const sorted = variables.filter(defaultVariablesFilter).sort((v1, v2) => v1.index - v2.index);
    return sorted.length > 0 ? sorted[sorted.length - 1].index + 1 : 0;
}
export function getVariablesIsDirty(key, state = getState()) {
    return getVariablesState(key, state).transaction.isDirty;
}
export function getIfExistsLastKey(state = getState()) {
    var _a;
    return (_a = state.templating) === null || _a === void 0 ? void 0 : _a.lastKey;
}
export function getLastKey(state = getState()) {
    var _a;
    if (!((_a = state.templating) === null || _a === void 0 ? void 0 : _a.lastKey)) {
        throw new Error('Accessing lastKey without initializing it variables');
    }
    return state.templating.lastKey;
}
// selectors used by template srv, assumes that lastKey is in state. Needs to change when/if dashboard redux state becomes keyed too.
export function getFilteredVariables(filter, state = getState()) {
    const lastKey = getIfExistsLastKey(state);
    if (!lastKey) {
        return [];
    }
    return getFilteredVariablesByKey(filter, lastKey, state);
}
export function getVariables(state = getState()) {
    const lastKey = getIfExistsLastKey(state);
    if (!lastKey) {
        return [];
    }
    return getVariablesByKey(lastKey, state);
}
export function getVariableWithName(name, state = getState()) {
    const lastKey = getIfExistsLastKey(state);
    if (!lastKey) {
        return;
    }
    return getVariable({ id: name, rootStateKey: lastKey, type: 'query' }, state, false);
}
export function getInstanceState(state, id) {
    return state[id];
}
//# sourceMappingURL=selectors.js.map