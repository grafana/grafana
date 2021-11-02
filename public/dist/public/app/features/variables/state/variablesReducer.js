import { createAction } from '@reduxjs/toolkit';
import { variableAdapters } from '../adapters';
import { sharedReducer } from './sharedReducer';
import { initialVariablesState } from './types';
export var cleanVariables = createAction('templating/cleanVariables');
export var variablesReducer = function (state, action) {
    var _a, _b;
    if (state === void 0) { state = initialVariablesState; }
    if (cleanVariables.match(action)) {
        var globalVariables = Object.values(state).filter(function (v) { return v.global; });
        if (!globalVariables) {
            return initialVariablesState;
        }
        var variables = globalVariables.reduce(function (allVariables, state) {
            allVariables[state.id] = state;
            return allVariables;
        }, {});
        return variables;
    }
    if (((_a = action === null || action === void 0 ? void 0 : action.payload) === null || _a === void 0 ? void 0 : _a.type) && variableAdapters.getIfExists((_b = action === null || action === void 0 ? void 0 : action.payload) === null || _b === void 0 ? void 0 : _b.type)) {
        // Now that we know we are dealing with a payload that is addressed for an adapted variable let's reduce state:
        // Firstly call the sharedTemplatingReducer that handles all shared actions between variable types
        // Secondly call the specific variable type's reducer
        return variableAdapters.get(action.payload.type).reducer(sharedReducer(state, action), action);
    }
    return state;
};
//# sourceMappingURL=variablesReducer.js.map