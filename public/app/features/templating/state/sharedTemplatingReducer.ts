import { createReducer } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import {
  changeToEditorEditMode,
  changeToEditorListMode,
  changeVariableOrder,
  changeVariableType,
  duplicateVariable,
  removeVariable,
  storeNewVariable,
} from './actions';
import { VariableModel } from '../variable';
import { emptyUuid, getInstanceState, VariableState } from './types';
import { initialTemplatingState } from './reducers';
import { variableAdapters } from '../adapters';
import { changeVariableNameSucceeded, variableEditorUnMounted } from '../editor/reducer';

export const sharedTemplatingReducer = createReducer(initialTemplatingState, builder =>
  builder
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

      state.uuidInEditor = null;

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
      state.uuidInEditor = action.payload.uuid;
    })
    .addCase(changeToEditorListMode, (state, action) => {
      state.uuidInEditor = null;
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
);
