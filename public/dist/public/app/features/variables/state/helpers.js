import { __assign } from "tslib";
import { combineReducers } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';
import { NEW_VARIABLE_ID } from './types';
import { VariableHide } from '../types';
import { dashboardReducer } from 'app/features/dashboard/state/reducers';
import { templatingReducers } from './reducers';
export var getVariableState = function (noOfVariables, inEditorIndex, includeEmpty) {
    if (inEditorIndex === void 0) { inEditorIndex = -1; }
    if (includeEmpty === void 0) { includeEmpty = false; }
    var variables = {};
    for (var index = 0; index < noOfVariables; index++) {
        variables[index] = {
            id: index.toString(),
            type: 'query',
            name: "Name-" + index,
            hide: VariableHide.dontHide,
            index: index,
            label: "Label-" + index,
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
        };
    }
    if (includeEmpty) {
        variables[NEW_VARIABLE_ID] = {
            id: NEW_VARIABLE_ID,
            type: 'query',
            name: "Name-" + NEW_VARIABLE_ID,
            hide: VariableHide.dontHide,
            index: noOfVariables,
            label: "Label-" + NEW_VARIABLE_ID,
            skipUrlSync: false,
            global: false,
            state: LoadingState.NotStarted,
            error: null,
            description: null,
        };
    }
    return variables;
};
export var getVariableTestContext = function (adapter, variableOverrides) {
    if (variableOverrides === void 0) { variableOverrides = {}; }
    var defaultVariable = __assign(__assign({}, adapter.initialState), { id: '0', index: 0, name: '0' });
    var initialState = {
        '0': __assign(__assign({}, defaultVariable), variableOverrides),
    };
    return { initialState: initialState };
};
export var getRootReducer = function () {
    return combineReducers({
        dashboard: dashboardReducer,
        templating: templatingReducers,
    });
};
export var getTemplatingRootReducer = function () {
    return combineReducers({
        templating: templatingReducers,
    });
};
//# sourceMappingURL=helpers.js.map