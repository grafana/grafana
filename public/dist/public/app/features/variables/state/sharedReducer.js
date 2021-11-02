var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { cloneDeep, defaults as lodashDefaults } from 'lodash';
import { LoadingState } from '@grafana/data';
import { getInstanceState, initialVariablesState } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { ensureStringValues } from '../utils';
var sharedReducerSlice = createSlice({
    name: 'templating/shared',
    initialState: initialVariablesState,
    reducers: {
        addVariable: function (state, action) {
            var _a;
            var id = (_a = action.payload.id) !== null && _a !== void 0 ? _a : action.payload.data.model.name; // for testing purposes we can call this with an id
            var adapter = variableAdapters.get(action.payload.type);
            var initialState = cloneDeep(adapter.initialState);
            var model = adapter.beforeAdding
                ? adapter.beforeAdding(action.payload.data.model)
                : cloneDeep(action.payload.data.model);
            var variable = __assign(__assign({}, lodashDefaults({}, model, initialState)), { id: id, index: action.payload.data.index, global: action.payload.data.global });
            state[id] = variable;
        },
        variableStateNotStarted: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.state = LoadingState.NotStarted;
            instanceState.error = null;
        },
        variableStateFetching: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.state = LoadingState.Loading;
            instanceState.error = null;
        },
        variableStateCompleted: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            if (!instanceState) {
                // we might have cancelled a batch so then this state has been removed
                return;
            }
            instanceState.state = LoadingState.Done;
            instanceState.error = null;
        },
        variableStateFailed: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            if (!instanceState) {
                // we might have cancelled a batch so then this state has been removed
                return;
            }
            instanceState.state = LoadingState.Error;
            instanceState.error = action.payload.data.error;
        },
        removeVariable: function (state, action) {
            delete state[action.payload.id];
            if (!action.payload.data.reIndex) {
                return;
            }
            var variableStates = Object.values(state);
            for (var index = 0; index < variableStates.length; index++) {
                variableStates[index].index = index;
            }
        },
        duplicateVariable: function (state, action) {
            var _a, _b;
            var original = cloneDeep(state[action.payload.id]);
            var name = "copy_of_" + original.name;
            var newId = (_b = (_a = action.payload.data) === null || _a === void 0 ? void 0 : _a.newId) !== null && _b !== void 0 ? _b : name;
            var index = Object.keys(state).length;
            state[newId] = __assign(__assign(__assign({}, cloneDeep(variableAdapters.get(action.payload.type).initialState)), original), { id: newId, name: name, index: index });
        },
        changeVariableOrder: function (state, action) {
            var variables = Object.values(state).map(function (s) { return s; });
            var fromVariable = variables.find(function (v) { return v.index === action.payload.data.fromIndex; });
            var toVariable = variables.find(function (v) { return v.index === action.payload.data.toIndex; });
            if (fromVariable) {
                state[fromVariable.id].index = action.payload.data.toIndex;
            }
            if (toVariable) {
                state[toVariable.id].index = action.payload.data.fromIndex;
            }
        },
        changeVariableType: function (state, action) {
            var id = action.payload.id;
            var _a = state[id], label = _a.label, name = _a.name, index = _a.index, description = _a.description;
            state[id] = __assign(__assign({}, cloneDeep(variableAdapters.get(action.payload.data.newType).initialState)), { id: id, label: label, name: name, index: index, description: description });
        },
        setCurrentVariableValue: function (state, action) {
            if (!action.payload.data.option) {
                return;
            }
            var instanceState = getInstanceState(state, action.payload.id);
            var option = action.payload.data.option;
            var current = __assign(__assign({}, option), { text: ensureStringValues(option === null || option === void 0 ? void 0 : option.text), value: ensureStringValues(option === null || option === void 0 ? void 0 : option.value) });
            instanceState.current = current;
            instanceState.options = instanceState.options.map(function (option) {
                option.value = ensureStringValues(option.value);
                var selected = false;
                if (Array.isArray(current.value)) {
                    for (var index = 0; index < current.value.length; index++) {
                        var value = current.value[index];
                        if (option.value === value) {
                            selected = true;
                            break;
                        }
                    }
                }
                else if (option.value === current.value) {
                    selected = true;
                }
                option.selected = selected;
                return option;
            });
        },
        changeVariableProp: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState[action.payload.data.propName] = action.payload.data.propValue;
        },
    },
    extraReducers: function (builder) {
        return builder.addCase(changeVariableNameSucceeded, function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.name = action.payload.data.newName;
        });
    },
});
export var sharedReducer = sharedReducerSlice.reducer;
export var removeVariable = (_a = sharedReducerSlice.actions, _a.removeVariable), addVariable = _a.addVariable, changeVariableProp = _a.changeVariableProp, changeVariableOrder = _a.changeVariableOrder, duplicateVariable = _a.duplicateVariable, setCurrentVariableValue = _a.setCurrentVariableValue, changeVariableType = _a.changeVariableType, variableStateNotStarted = _a.variableStateNotStarted, variableStateFetching = _a.variableStateFetching, variableStateCompleted = _a.variableStateCompleted, variableStateFailed = _a.variableStateFailed;
//# sourceMappingURL=sharedReducer.js.map