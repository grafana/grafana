import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import { VariableModel, VariableOption, VariableType, VariableWithOptions } from '../variable';
import { AddVariable, ALL_VARIABLE_VALUE, EMPTY_UUID, getInstanceState, VariablePayload } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { Deferred } from '../../../core/utils/deferred';
import { initialVariablesState, VariablesState } from './variablesReducer';
import { isQuery } from '../guard';
import { v4 } from 'uuid';

const sharedReducerSlice = createSlice({
  name: 'templating/shared',
  initialState: initialVariablesState,
  reducers: {
    addVariable: (state: VariablesState, action: PayloadAction<VariablePayload<AddVariable>>) => {
      const uuid = action.payload.uuid ?? v4(); // for testing purposes we can call this with an uuid
      state[uuid] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...action.payload.data.model,
      };
      state[uuid].uuid = uuid;
      state[uuid].index = action.payload.data.index;
      state[uuid].global = action.payload.data.global;
    },
    addInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.initLock = new Deferred();
    },
    resolveInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.initLock?.resolve();
    },
    removeInitLock: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.initLock = null;
    },
    removeVariable: (state: VariablesState, action: PayloadAction<VariablePayload<{ reIndex: boolean }>>) => {
      delete state[action.payload.uuid!];
      if (!action.payload.data.reIndex) {
        return;
      }

      const variableStates = Object.values(state);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].index = index;
      }
    },
    duplicateVariable: (state: VariablesState, action: PayloadAction<VariablePayload<{ newUuid: string }>>) => {
      const newUuid = action.payload.data?.newUuid ?? v4();
      const original = cloneDeep<VariableModel>(state[action.payload.uuid]);
      const index = Object.keys(state).length;
      const name = `copy_of_${original.name}`;
      state[newUuid] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...original,
        uuid: newUuid,
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
        state[fromVariable.uuid!].index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state[toVariable.uuid!].index = action.payload.data.fromIndex;
      }
    },
    storeNewVariable: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const uuid = action.payload.uuid!;
      const emptyVariable = cloneDeep<VariableModel>(state[EMPTY_UUID]);
      state[uuid!] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...emptyVariable,
        uuid,
        index: emptyVariable.index,
      };
    },
    changeVariableType: (state: VariablesState, action: PayloadAction<VariablePayload<{ newType: VariableType }>>) => {
      const { uuid } = action.payload;
      const { label, name, index } = state[uuid!];

      state[uuid!] = {
        ...cloneDeep(variableAdapters.get(action.payload.data.newType).initialState),
        uuid,
        label,
        name,
        index,
      };
    },
    setCurrentVariableValue: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<{ option: VariableOption }>>
    ) => {
      const instanceState = getInstanceState<VariableWithOptions>(state, action.payload.uuid);
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
      const instanceState = getInstanceState(state, action.payload.uuid!);
      (instanceState as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    },
  },
  extraReducers: builder =>
    builder.addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid);
      instanceState.name = action.payload.data;
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
