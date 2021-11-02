import { getState } from '../../../store/store';
import memoizeOne from 'memoize-one';
export var getVariable = function (id, state, throwWhenMissing) {
    if (state === void 0) { state = getState(); }
    if (throwWhenMissing === void 0) { throwWhenMissing = true; }
    if (!state.templating.variables[id]) {
        if (throwWhenMissing) {
            throw new Error("Couldn't find variable with id:" + id);
        }
        return undefined;
    }
    return state.templating.variables[id];
};
export var getFilteredVariables = function (filter, state) {
    if (state === void 0) { state = getState(); }
    return Object.values(state.templating.variables)
        .filter(filter)
        .sort(function (s1, s2) { return s1.index - s2.index; });
};
export var getVariableWithName = function (name, state) {
    if (state === void 0) { state = getState(); }
    return getVariable(name, state, false);
};
export var getVariables = function (state) {
    if (state === void 0) { state = getState(); }
    var filter = function (variable) {
        return variable.type !== 'system';
    };
    return getFilteredVariables(filter, state);
};
export var getSubMenuVariables = memoizeOne(function (variables) {
    return getVariables(getState());
});
export var getEditorVariables = function (state) {
    return getVariables(state);
};
export var getNewVariabelIndex = function (state) {
    if (state === void 0) { state = getState(); }
    return Object.values(state.templating.variables).length;
};
//# sourceMappingURL=selectors.js.map