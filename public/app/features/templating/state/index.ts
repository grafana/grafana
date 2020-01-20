import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { initialQueryVariablesState, QueryVariablesState } from './queryVariablesReducer';
import { VariableType } from '../variable';
import {
  addVariable,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  setInitLock,
  updateVariableOptions,
  updateVariableTags,
} from './actions';
import { variableAdapter } from '../adapters';

export interface TemplatingState extends Record<VariableType, any> {
  query: QueryVariablesState;
}

export const initialState = {
  query: initialQueryVariablesState,
};

export const updateChildState = (type: VariableType, state: TemplatingState, action: PayloadAction<any>) => {
  const reducer = variableAdapter[type].getReducer();
  if (!reducer) {
    throw new Error(`Reducer for type ${type} could not be found.`);
  }
  state[type] = reducer(state[type], action);
};

const templatingSlice = createSlice({
  name: 'templating',
  initialState,
  reducers: {},
  extraReducers: builder =>
    builder
      .addCase(addVariable, (state: TemplatingState, action) => {
        const { type } = action.payload.model;
        return updateChildState(type, state, action);
      })
      .addCase(updateVariableOptions, (state: TemplatingState, action) => {
        const { type } = action.payload.variable;
        return updateChildState(type, state, action);
      })
      .addCase(updateVariableTags, (state: TemplatingState, action) => {
        const { type } = action.payload.variable;
        return updateChildState(type, state, action);
      })
      .addCase(setCurrentVariableValue, (state: TemplatingState, action) => {
        const { type } = action.payload.variable;
        return updateChildState(type, state, action);
      })
      .addCase(setInitLock, (state: TemplatingState, action) => {
        return updateChildState(action.payload.type, state, action);
      })
      .addCase(resolveInitLock, (state: TemplatingState, action) => {
        return updateChildState(action.payload.type, state, action);
      })
      .addCase(removeInitLock, (state: TemplatingState, action) => {
        return updateChildState(action.payload.type, state, action);
      }),
});

export const templatingReducer = templatingSlice.reducer;

export default {
  templating: templatingReducer,
};
