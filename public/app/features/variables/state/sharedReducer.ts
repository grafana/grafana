import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';
import { default as lodashDefaults } from 'lodash/defaults';

import { VariableType } from '@grafana/data';
import { VariableModel, VariableOption, VariableWithOptions } from '../types';
import { AddVariable, ALL_VARIABLE_VALUE, getInstanceState, NEW_VARIABLE_ID, VariablePayload } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { Deferred } from '../../../core/utils/deferred';
import { initialVariablesState, VariablesState } from './variablesReducer';
import { isQuery } from '../guard';

const sharedReducerSlice = createSlice({
  name: 'templating/shared',
  initialState: initialVariablesState,
  reducers: {
    addVariable: (state: VariablesState, action: PayloadAction<VariablePayload<AddVariable>>) => {
      const id = action.payload.id ?? action.payload.data.model.name; // for testing purposes we can call this with an id
      const initialState = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      const model = cloneDeep(action.payload.data.model);

      const variable = {
        ...lodashDefaults({}, model, initialState),
        id: id,
        index: action.payload.data.index,
        global: action.payload.data.global,
      };

      state[id] = variable;
    },
    addInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      instanceState.initLock = new Deferred();
    },
    resolveInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);

      if (!instanceState) {
        // we might have cancelled a batch so then this state has been removed
        return;
      }
      instanceState.initLock?.resolve();
    },
    removeInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);

      if (!instanceState) {
        // we might have cancelled a batch so then this state has been removed
        return;
      }
      instanceState.initLock = null;
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
      const variables = Object.values(state).map(s => s);
      const fromVariable = variables.find(v => v.index === action.payload.data.fromIndex);
      const toVariable = variables.find(v => v.index === action.payload.data.toIndex);

      if (fromVariable) {
        state[fromVariable.id].index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state[toVariable.id].index = action.payload.data.fromIndex;
      }
    },
    storeNewVariable: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const id = action.payload.id;
      const emptyVariable = cloneDeep<VariableModel>(state[NEW_VARIABLE_ID]);
      state[id] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...emptyVariable,
        id,
        index: emptyVariable.index,
      };
    },
    changeVariableType: (state: VariablesState, action: PayloadAction<VariablePayload<{ newType: VariableType }>>) => {
      const { id } = action.payload;
      const { label, name, index } = state[id];

      state[id] = {
        ...cloneDeep(variableAdapters.get(action.payload.data.newType).initialState),
        id: id,
        label,
        name,
        index,
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
      const current = { ...action.payload.data.option };

      if (Array.isArray(current.text) && current.text.length > 0) {
        current.text = current.text.join(' + ');
      } else if (Array.isArray(current.value) && current.value[0] !== ALL_VARIABLE_VALUE) {
        current.text = current.value.join(' + ');
      }

      instanceState.current = current;
      instanceState.options = instanceState.options.map(option => {
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

      if (hasTags(current) && isQuery(instanceState)) {
        const selected = current!.tags!.reduce((all: Record<string, boolean>, tag) => {
          all[tag.text.toString()] = tag.selected;
          return all;
        }, {});

        instanceState.tags = instanceState.tags.map(t => {
          const text = t.text.toString();
          t.selected = selected[text];
          return t;
        });
      }
    },
    changeVariableProp: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ propName: string; propValue: any }>>
    ) => {
      const instanceState = getInstanceState(state, action.payload.id);
      (instanceState as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    },
  },
  extraReducers: builder =>
    builder.addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.id);
      instanceState.name = action.payload.data.newName;
    }),
});

export const sharedReducer = sharedReducerSlice.reducer;

export const {
  addInitLock,
  removeVariable,
  addVariable,
  changeVariableProp,
  changeVariableOrder,
  storeNewVariable,
  duplicateVariable,
  setCurrentVariableValue,
  changeVariableType,
  removeInitLock,
  resolveInitLock,
} = sharedReducerSlice.actions;

const hasTags = (option: VariableOption): boolean => {
  return Array.isArray(option.tags);
};
