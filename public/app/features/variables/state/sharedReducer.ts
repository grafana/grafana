import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep, defaults as lodashDefaults } from 'lodash';
import { LoadingState, VariableType } from '@grafana/data';
import { VariableModel, VariableOption, VariableWithOptions } from '../types';
import { AddVariable, getInstanceState, initialVariablesState, VariablePayload, VariablesState } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { ensureStringValues } from '../utils';

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

      const variableStates = Object.values(state);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].index = index;
      }
    },
    duplicateVariable: (state: VariablesState, action: PayloadAction<VariablePayload<{ newId: string }>>) => {
      const original = cloneDeep<VariableModel>(state[action.payload.id]);
      const name = `copy_of_${original.name}`;
      const newId = action.payload.data?.newId ?? name;
      const index = Object.keys(state).length;
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
      const variables = Object.values(state).map((s) => s);
      const fromVariable = variables.find((v) => v.index === action.payload.data.fromIndex);
      const toVariable = variables.find((v) => v.index === action.payload.data.toIndex);

      if (fromVariable) {
        state[fromVariable.id].index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state[toVariable.id].index = action.payload.data.fromIndex;
      }
    },
    changeVariableType: (state: VariablesState, action: PayloadAction<VariablePayload<{ newType: VariableType }>>) => {
      const { id } = action.payload;
      const { label, name, index, description } = state[id];

      state[id] = {
        ...cloneDeep(variableAdapters.get(action.payload.data.newType).initialState),
        id: id,
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

      const instanceState = getInstanceState<VariableWithOptions>(state, action.payload.id);
      const { option } = action.payload.data;
      const current = { ...option, text: ensureStringValues(option?.text), value: ensureStringValues(option?.value) };

      // If no value is set, default to the first avilable
      if (!current.value && instanceState.options.length) {
        instanceState.options.forEach((option, index) => {
          option.selected = !Boolean(index);
        });
        instanceState.current = instanceState.options[0];
        return;
      }

      instanceState.current = current;
      instanceState.options = instanceState.options.map((option) => {
        option.value = ensureStringValues(option.value);
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
