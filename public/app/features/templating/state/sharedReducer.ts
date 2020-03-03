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
import { VariableModel, VariableWithOptions } from '../variable';
import { ALL_VARIABLE_VALUE, emptyUuid, getInstanceState, VariableState } from './types';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded, variableEditorUnMounted } from '../editor/reducer';
import { Deferred } from '../deferred';
import { changeToEditorEditMode } from './uuidInEditorReducer';
import { initialVariablesState } from './variablesReducer';

export const sharedReducer = createReducer(initialVariablesState, builder =>
  builder
    .addCase(addVariable, (state, action) => {
      state[action.payload.uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state[action.payload.uuid!].variable = {
        ...state[action.payload.uuid!].variable,
        ...action.payload.data.model,
      };
      state[action.payload.uuid!].variable.uuid = action.payload.uuid;
      state[action.payload.uuid!].variable.index = action.payload.data.index;
      state[action.payload.uuid!].variable.global = action.payload.data.global;
      state[action.payload.uuid!].variable.initLock = new Deferred();
    })
    .addCase(resolveInitLock, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.variable.initLock?.resolve();
    })
    .addCase(removeInitLock, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      instanceState.variable.initLock = null;
    })
    .addCase(removeVariable, (state, action) => {
      delete state[action.payload.uuid!];
      const variableStates = Object.values(state);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].variable.index = index;
      }
    })
    .addCase(variableEditorUnMounted, (state, action) => {
      const variableState = state[action.payload.uuid!];

      if (action.payload.uuid === emptyUuid && !variableState) {
        return;
      }

      if (state[emptyUuid]) {
        delete state[emptyUuid];
      }
    })
    .addCase(duplicateVariable, (state, action) => {
      const original = cloneDeep<VariableModel>(state[action.payload.uuid].variable);
      const uuid = action.payload.data.newUuid;
      const index = Object.keys(state).length;
      const name = `copy_of_${original.name}`;
      state[uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state[uuid!].variable = original;
      state[uuid!].variable.uuid = uuid;
      state[uuid!].variable.name = name;
      state[uuid!].variable.index = index;
    })
    .addCase(changeVariableOrder, (state, action) => {
      const variables = Object.values(state).map(s => s.variable);
      const fromVariable = variables.find(v => v.index === action.payload.data.fromIndex);
      const toVariable = variables.find(v => v.index === action.payload.data.toIndex);

      if (fromVariable) {
        state[fromVariable.uuid!].variable.index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state[toVariable.uuid!].variable.index = action.payload.data.fromIndex;
      }
    })
    .addCase(storeNewVariable, (state, action) => {
      const uuid = action.payload.uuid!;
      const emptyVariable: VariableModel = cloneDeep<VariableModel>(state[emptyUuid].variable);
      state[uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state[uuid!].variable = emptyVariable;
      state[uuid!].variable.uuid = uuid;
    })
    .addCase(changeToEditorEditMode, (state, action) => {
      if (action.payload.uuid === emptyUuid) {
        state[emptyUuid] = cloneDeep(variableAdapters.get('query').initialState);
        state[emptyUuid].variable.uuid = emptyUuid;
        state[emptyUuid].variable.index = Object.values(state).length - 1;
      }
    })
    .addCase(changeVariableType, (state, action) => {
      const { uuid } = action.payload;
      const initialState = cloneDeep(variableAdapters.get(action.payload.data).initialState);
      const { label, name, index } = (state[uuid!] as VariableState).variable;

      state[uuid!] = {
        ...initialState,
        variable: {
          ...initialState.variable,
          uuid,
          label,
          name,
          index,
        },
      };
    })
    .addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid);
      instanceState.variable.name = action.payload.data;
    })
    .addCase(setCurrentVariableValue, (state, action) => {
      const instanceState = getInstanceState<VariableState<VariableWithOptions>>(state, action.payload.uuid);
      const current = { ...action.payload.data };

      if (Array.isArray(current.text) && current.text.length > 0) {
        current.text = current.text.join(' + ');
      } else if (Array.isArray(current.value) && current.value[0] !== ALL_VARIABLE_VALUE) {
        current.text = current.value.join(' + ');
      }

      instanceState.variable.current = current;
      instanceState.variable.options = instanceState.variable.options.map(option => {
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
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState(state, action.payload.uuid!);
      (instanceState.variable as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    })
);
