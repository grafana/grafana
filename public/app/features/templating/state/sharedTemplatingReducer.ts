import { createReducer } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import {
  changeToEditorEditMode,
  changeToEditorListMode,
  changeVariableHide,
  changeVariableLabel,
  changeVariableOrder,
  duplicateVariable,
  removeVariable,
  storeNewVariable,
  updateVariableCompleted,
  updateVariableFailed,
  updateVariableStarting,
  variableEditorMounted,
  variableEditorUnMounted,
} from './actions';
import { VariableModel } from '../variable';
import { emptyUuid, initialVariableEditorState } from './types';
import { initialTemplatingState } from './index';
import { variableAdapters } from '../adapters';

export const sharedTemplatingReducer = createReducer(initialTemplatingState, builder =>
  builder
    .addCase(removeVariable, (state, action) => {
      delete state.variables[action.payload.uuid!];
      const variableStates = Object.values(state.variables);
      for (let index = 0; index < variableStates.length; index++) {
        variableStates[index].variable.index = index;
      }
    })
    .addCase(variableEditorMounted, (state, action) => {
      state.variables[action.payload.uuid!].editor.name = state.variables[action.payload.uuid].variable.name;
      state.variables[action.payload.uuid!].editor.type = state.variables[action.payload.uuid].variable.type;
      state.variables[action.payload.uuid!].editor.dataSources = action.payload.data;
    })
    .addCase(variableEditorUnMounted, (state, action) => {
      if (!state.variables[action.payload.uuid!]) {
        // this could be an unmount event from a variable that doesn't exist any longer
        return;
      }
      state.variables[action.payload.uuid!].editor = { ...initialVariableEditorState };
      if (state.variables[emptyUuid]) {
        delete state.variables[emptyUuid];
      }
    })
    .addCase(changeVariableLabel, (state, action) => {
      state.variables[action.payload.uuid!].variable.label = action.payload.data;
    })
    .addCase(changeVariableHide, (state, action) => {
      state.variables[action.payload.uuid!].variable.hide = action.payload.data;
    })
    .addCase(updateVariableStarting, (state, action) => {
      state.variables[action.payload.uuid!].editor = {
        ...initialVariableEditorState,
        ...state.variables[action.payload.uuid!].editor,
      };
    })
    .addCase(updateVariableCompleted, (state, action) => {
      state.variables[action.payload.uuid!].editor = {
        ...initialVariableEditorState,
        ...state.variables[action.payload.uuid!].editor,
      };
    })
    .addCase(updateVariableFailed, (state, action) => {
      state.variables[action.payload.uuid!].editor.isValid = false;
      state.variables[action.payload.uuid!].editor.errors.update = action.payload.data.message;
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
      state.uuidInEditor = null;
      delete state.variables[emptyUuid];
    })
    .addCase(changeToEditorEditMode, (state, action) => {
      if (action.payload.uuid === emptyUuid) {
        state.variables[emptyUuid] = cloneDeep(variableAdapters.get('query').initialState);
        state.variables[emptyUuid].variable.uuid = emptyUuid;
        state.variables[emptyUuid].variable.index = Object.values(state.variables).length;
      }
      state.uuidInEditor = action.payload.uuid;
    })
    .addCase(changeToEditorListMode, (state, action) => {
      state.uuidInEditor = null;
    })
);
