import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep, defaults as lodashDefaults } from 'lodash';

import { LoadingState, VariableType } from '@grafana/data';

import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { hasOptions } from '../guard';
import { VariableModel, VariableOption } from '../types';
import { ensureStringValues } from '../utils';

import { getInstanceState, getNextVariableIndex } from './selectors';
import { AddVariable, initialVariablesState, VariablePayload, VariablesState } from './types';

const sharedReducerSlice = createSlice({
  name: 'templating/shared',
  initialState: initialVariablesState,
  reducers: {
    addVariable: (state: VariablesState, action: PayloadAction<VariablePayload<AddVariable>>) => {
      const id = action.payload.id ?? action.payload.data.model.name; // for testing purposes we can call this with an id
      const adapter = variableAdapters.get(action.payload.type);
      const initialState = cloneDeep(adapter.initialState);
      const model = adapter.beforeAdding
        ? adapter.beforeAdding(action.payload.data.model)
        : cloneDeep(action.payload.data.model);

      const variable = {
        ...lodashDefaults({}, model, initialState),
        id: id,
        index: action.payload.data.index,
        global: action.payload.data.global,
      };

      state[id] = variable;
    },
    variableStateNotStarted: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      instanceState.state = LoadingState.NotStarted;
      instanceState.error = null;
    },
    variableStateFetching: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      instanceState.state = LoadingState.Loading;
      instanceState.error = null;
    },
    variableStateCompleted: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (!instanceState) {
        // we might have cancelled a batch so then this state has been removed
        return;
      }
      instanceState.state = LoadingState.Done;
      instanceState.error = null;
    },
    variableStateFailed: (state: VariablesState, action: PayloadAction<VariablePayload<{ error: any }>>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (!instanceState) {
        // we might have cancelled a batch so then this state has been removed
        return;
      }
      instanceState.state = LoadingState.Error;
      instanceState.error = action.payload.data.error;
    },
    removeVariable: (state: VariablesState, action: PayloadAction<VariablePayload<{ reIndex: boolean }>>) => {
      delete state[action.payload.id];
      if (!action.payload.data.reIndex) {
        return;
      }

      const variableStates = Object.values(state).sort((a, b) => a.index - b.index);
      for (let i = 0; i < variableStates.length; i++) {
        variableStates[i].index = i;
      }
    },
    duplicateVariable: (state: VariablesState, action: PayloadAction<VariablePayload<{ newId: string }>>) => {
      function escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      const original = cloneDeep<VariableModel>(state[action.payload.id]);
      const copyRegex = new RegExp(`^copy_of_${escapeRegExp(original.name)}(_(\\d+))?$`);

      const copies = Object.values(state)
        .map(({ name }) => name.match(copyRegex))
        .filter((v): v is RegExpMatchArray => v != null);
      const numberedCopies = copies.map((match) => match[2]).filter((v): v is string => v != null);

      const suffix = ((): number | null => {
        if (copies.length === 0) {
          return null;
        }
        if (numberedCopies.length === 0) {
          return 1;
        }
        return numberedCopies.map((v) => +v).sort((a, b) => b - a)[0] + 1;
      })();

      const name = `copy_of_${original.name}${suffix ? `_${suffix}` : ''}`;
      const newId = action.payload.data?.newId ?? name;
      const index = getNextVariableIndex(Object.values(state));
      state[newId] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...original,
        id: newId,
        name,
        index,
      };
    },
    changeVariableOrder: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ fromIndex: number; toIndex: number }>>
    ) => {
      const { toIndex, fromIndex } = action.payload.data;
      const variableStates = Object.values(state);
      for (let index = 0; index < variableStates.length; index++) {
        const variable = variableStates[index];
        if (variable.index === fromIndex) {
          variable.index = toIndex;
        } else if (variable.index > fromIndex && variable.index <= toIndex) {
          variable.index--;
        } else if (variable.index < fromIndex && variable.index >= toIndex) {
          variable.index++;
        }
      }
    },
    changeVariableType: (state: VariablesState, action: PayloadAction<VariablePayload<{ newType: VariableType }>>) => {
      const { id } = action.payload;
      const { label, name, index, description, rootStateKey } = state[id];

      state[id] = {
        ...cloneDeep(variableAdapters.get(action.payload.data.newType).initialState),
        id,
        rootStateKey: rootStateKey,
        label,
        name,
        index,
        description,
      };
    },
    setCurrentVariableValue: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ option: VariableOption | undefined }>>
    ) => {
      if (!action.payload.data.option) {
        return;
      }

      const instanceState = getInstanceState(state, action.payload.id);
      if (!hasOptions(instanceState)) {
        return;
      }

      const { option } = action.payload.data;
      const current = { ...option, text: ensureStringValues(option?.text), value: ensureStringValues(option?.value) };

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
        } else if (option.value === current.value) {
          selected = true;
        }
        option.selected = selected;
        return option;
      });
    },
    changeVariableProp: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ propName: string; propValue: any }>>
    ) => {
      const instanceState = getInstanceState(state, action.payload.id);
      (instanceState as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    },
  },
  extraReducers: (builder) =>
    builder.addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.id);
      instanceState.name = action.payload.data.newName;
    }),
});

export const sharedReducer = sharedReducerSlice.reducer;

export const {
  removeVariable,
  addVariable,
  changeVariableProp,
  changeVariableOrder,
  duplicateVariable,
  setCurrentVariableValue,
  changeVariableType,
  variableStateNotStarted,
  variableStateFetching,
  variableStateCompleted,
  variableStateFailed,
} = sharedReducerSlice.actions;
