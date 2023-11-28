import { createSlice } from '@reduxjs/toolkit';
import { cloneDeep, defaults as lodashDefaults } from 'lodash';
import { LoadingState } from '@grafana/data';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { hasOptions } from '../guard';
import { ensureStringValues } from '../utils';
import { getInstanceState, getNextVariableIndex } from './selectors';
import { initialVariablesState } from './types';
const sharedReducerSlice = createSlice({
    name: 'templating/shared',
    initialState: initialVariablesState,
    reducers: {
        addVariable: (state, action) => {
            var _a;
            const id = (_a = action.payload.id) !== null && _a !== void 0 ? _a : action.payload.data.model.name; // for testing purposes we can call this with an id
            const adapter = variableAdapters.get(action.payload.type);
            const initialState = cloneDeep(adapter.initialState);
            const model = adapter.beforeAdding
                ? adapter.beforeAdding(action.payload.data.model)
                : cloneDeep(action.payload.data.model);
            const variable = Object.assign(Object.assign({}, lodashDefaults({}, model, initialState)), { id: id, index: action.payload.data.index, global: action.payload.data.global });
            state[id] = variable;
        },
        variableStateNotStarted: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            instanceState.state = LoadingState.NotStarted;
            instanceState.error = null;
        },
        variableStateFetching: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            instanceState.state = LoadingState.Loading;
            instanceState.error = null;
        },
        variableStateCompleted: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (!instanceState) {
                // we might have cancelled a batch so then this state has been removed
                return;
            }
            instanceState.state = LoadingState.Done;
            instanceState.error = null;
        },
        variableStateFailed: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (!instanceState) {
                // we might have cancelled a batch so then this state has been removed
                return;
            }
            instanceState.state = LoadingState.Error;
            instanceState.error = action.payload.data.error;
        },
        removeVariable: (state, action) => {
            delete state[action.payload.id];
            if (!action.payload.data.reIndex) {
                return;
            }
            const variableStates = Object.values(state).sort((a, b) => a.index - b.index);
            for (let i = 0; i < variableStates.length; i++) {
                variableStates[i].index = i;
            }
        },
        duplicateVariable: (state, action) => {
            var _a, _b;
            function escapeRegExp(string) {
                return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
            const original = cloneDeep(state[action.payload.id]);
            const copyRegex = new RegExp(`^copy_of_${escapeRegExp(original.name)}(_(\\d+))?$`);
            const copies = Object.values(state)
                .map(({ name }) => name.match(copyRegex))
                .filter((v) => v != null);
            const numberedCopies = copies.map((match) => match[2]).filter((v) => v != null);
            const suffix = (() => {
                if (copies.length === 0) {
                    return null;
                }
                if (numberedCopies.length === 0) {
                    return 1;
                }
                return numberedCopies.map((v) => +v).sort((a, b) => b - a)[0] + 1;
            })();
            const name = `copy_of_${original.name}${suffix ? `_${suffix}` : ''}`;
            const newId = (_b = (_a = action.payload.data) === null || _a === void 0 ? void 0 : _a.newId) !== null && _b !== void 0 ? _b : name;
            const index = getNextVariableIndex(Object.values(state));
            state[newId] = Object.assign(Object.assign(Object.assign({}, cloneDeep(variableAdapters.get(action.payload.type).initialState)), original), { id: newId, name,
                index });
        },
        changeVariableOrder: (state, action) => {
            const { toIndex, fromIndex } = action.payload.data;
            const variableStates = Object.values(state);
            for (let index = 0; index < variableStates.length; index++) {
                const variable = variableStates[index];
                if (variable.index === fromIndex) {
                    variable.index = toIndex;
                }
                else if (variable.index > fromIndex && variable.index <= toIndex) {
                    variable.index--;
                }
                else if (variable.index < fromIndex && variable.index >= toIndex) {
                    variable.index++;
                }
            }
        },
        changeVariableType: (state, action) => {
            const { id } = action.payload;
            const { label, name, index, description, rootStateKey } = state[id];
            state[id] = Object.assign(Object.assign({}, cloneDeep(variableAdapters.get(action.payload.data.newType).initialState)), { id, rootStateKey: rootStateKey, label,
                name,
                index,
                description });
        },
        setCurrentVariableValue: (state, action) => {
            if (!action.payload.data.option) {
                return;
            }
            const instanceState = getInstanceState(state, action.payload.id);
            if (!hasOptions(instanceState)) {
                return;
            }
            const { option } = action.payload.data;
            const current = Object.assign(Object.assign({}, option), { text: ensureStringValues(option === null || option === void 0 ? void 0 : option.text), value: ensureStringValues(option === null || option === void 0 ? void 0 : option.value) });
            instanceState.current = current;
            instanceState.options = instanceState.options.map((option) => {
                option.value = ensureStringValues(option.value);
                option.text = ensureStringValues(option.text);
                let selected = false;
                if (Array.isArray(current.value)) {
                    for (let index = 0; index < current.value.length; index++) {
                        const value = current.value[index];
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
        changeVariableProp: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            instanceState[action.payload.data.propName] = action.payload.data.propValue;
        },
    },
    extraReducers: (builder) => builder.addCase(changeVariableNameSucceeded, (state, action) => {
        const instanceState = getInstanceState(state, action.payload.id);
        instanceState.name = action.payload.data.newName;
    }),
});
export const sharedReducer = sharedReducerSlice.reducer;
export const { removeVariable, addVariable, changeVariableProp, changeVariableOrder, duplicateVariable, setCurrentVariableValue, changeVariableType, variableStateNotStarted, variableStateFetching, variableStateCompleted, variableStateFailed, } = sharedReducerSlice.actions;
//# sourceMappingURL=sharedReducer.js.map