import { createReducer } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import {
  addVariable,
  changeVariableOrder,
  changeVariableProp,
  changeVariableType,
  duplicateVariable,
  removeInitLock,
  removeVariable,
  resolveInitLock,
  setCurrentVariableValue,
  storeNewVariable,
} from './actions';
import { VariableModel, VariableOption, VariableWithOptions } from '../variable';
import { ALL_VARIABLE_VALUE, emptyUuid, getInstanceState } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded } from '../editor/reducer';
import { Deferred } from '../deferred';
import { initialVariablesState } from './variablesReducer';
import { isQuery } from '../guard';

export const sharedReducer = createReducer(initialVariablesState, builder =>
  builder
    .addCase(addVariable, (state, action) => {
      state[action.payload.uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state[action.payload.uuid!] = {
        ...state[action.payload.uuid!],
        ...action.payload.data.model,
      };
      state[action.payload.uuid!].uuid = action.payload.uuid;
      state[action.payload.uuid!].index = action.payload.data.index;
      state[action.payload.uuid!].global = action.payload.data.global;
      state[action.payload.uuid!].initLock = new Deferred();
    })
    .addCase(resolveInitLock, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.initLock?.resolve();
    })
    .addCase(removeInitLock, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.initLock = null;
    })
    .addCase(removeVariable, (state, action) => {
      delete state[action.payload.uuid!];
      if (!action.payload.data.reIndex) {
        return;
      }

      const variableStates = Object.values(state);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].index = index;
      }
    })
    .addCase(duplicateVariable, (state, action) => {
      const original = cloneDeep<VariableModel>(state[action.payload.uuid]);
      const uuid = action.payload.data.newUuid;
      const index = Object.keys(state).length;
      const name = `copy_of_${original.name}`;
      state[uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state[uuid!] = original;
      state[uuid!].uuid = uuid;
      state[uuid!].name = name;
      state[uuid!].index = index;
    })
    .addCase(changeVariableOrder, (state, action) => {
      const variables = Object.values(state).map(s => s);
      const fromVariable = variables.find(v => v.index === action.payload.data.fromIndex);
      const toVariable = variables.find(v => v.index === action.payload.data.toIndex);

      if (fromVariable) {
        state[fromVariable.uuid!].index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state[toVariable.uuid!].index = action.payload.data.fromIndex;
      }
    })
    .addCase(storeNewVariable, (state, action) => {
      const uuid = action.payload.uuid!;
      const emptyVariable = cloneDeep<VariableModel>(state[emptyUuid]);
      state[uuid!] = {
        ...cloneDeep(variableAdapters.get(action.payload.type).initialState),
        ...emptyVariable,
        uuid,
        index: Object.values(state).length - 1,
      };
    })
    .addCase(changeVariableType, (state, action) => {
      const { uuid } = action.payload;
      const initialState = cloneDeep(variableAdapters.get(action.payload.data).initialState);
      const { label, name, index } = state[uuid!];

      state[uuid!] = {
        ...initialState,
        uuid,
        label,
        name,
        index,
      };
    })
    .addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid);
      instanceState.name = action.payload.data;
    })
    .addCase(setCurrentVariableValue, (state, action) => {
      const instanceState = getInstanceState<VariableWithOptions>(state, action.payload.uuid);
      const current = { ...action.payload.data };

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
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      (instanceState as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    })
);

const hasTags = (option: VariableOption): boolean => {
  return Array.isArray(option.tags) && option.tags.length > 0;
};
