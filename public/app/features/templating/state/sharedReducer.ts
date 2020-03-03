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
      state.variables[action.payload.uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state.variables[action.payload.uuid!].variable = {
        ...state.variables[action.payload.uuid!].variable,
        ...action.payload.data.model,
      };
      state.variables[action.payload.uuid!].variable.uuid = action.payload.uuid;
      state.variables[action.payload.uuid!].variable.index = action.payload.data.index;
      state.variables[action.payload.uuid!].variable.global = action.payload.data.global;
      state.variables[action.payload.uuid!].variable.initLock = new Deferred();
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
      delete state.variables[action.payload.uuid!];
      const variableStates = Object.values(state.variables);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].variable.index = index;
      }
    })
    .addCase(variableEditorUnMounted, (state, action) => {
      const variableState = state.variables[action.payload.uuid!];

      if (action.payload.uuid === emptyUuid && !variableState) {
        return;
      }

      if (state.variables[emptyUuid]) {
        delete state.variables[emptyUuid];
      }
    })
    .addCase(duplicateVariable, (state, action) => {
      const original = cloneDeep<VariableModel>(state.variables[action.payload.uuid].variable);
      const uuid = action.payload.data.newUuid;
      const index = Object.keys(state.variables).length;
      const name = `copy_of_${original.name}`;
      state.variables[uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state.variables[uuid!].variable = original;
      state.variables[uuid!].variable.uuid = uuid;
      state.variables[uuid!].variable.name = name;
      state.variables[uuid!].variable.index = index;
    })
    .addCase(changeVariableOrder, (state, action) => {
      const variables = Object.values(state.variables).map(s => s.variable);
      const fromVariable = variables.find(v => v.index === action.payload.data.fromIndex);
      const toVariable = variables.find(v => v.index === action.payload.data.toIndex);

      if (fromVariable) {
        state.variables[fromVariable.uuid!].variable.index = action.payload.data.toIndex;
      }

      if (toVariable) {
        state.variables[toVariable.uuid!].variable.index = action.payload.data.fromIndex;
      }
    })
    .addCase(storeNewVariable, (state, action) => {
      const uuid = action.payload.uuid!;
      const emptyVariable: VariableModel = cloneDeep<VariableModel>(state.variables[emptyUuid].variable);
      state.variables[uuid!] = cloneDeep(variableAdapters.get(action.payload.type).initialState);
      state.variables[uuid!].variable = emptyVariable;
      state.variables[uuid!].variable.uuid = uuid;
    })
    .addCase(changeToEditorEditMode, (state, action) => {
      if (action.payload.uuid === emptyUuid) {
        state.variables[emptyUuid] = cloneDeep(variableAdapters.get('query').initialState);
        state.variables[emptyUuid].variable.uuid = emptyUuid;
        state.variables[emptyUuid].variable.index = Object.values(state.variables).length - 1;
      }
    })
    .addCase(changeVariableType, (state, action) => {
      const { uuid } = action.payload;
      const initialState = cloneDeep(variableAdapters.get(action.payload.data).initialState);
      const { label, name, index } = (state.variables[uuid!] as VariableState).variable;

      state.variables[uuid!] = {
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
