import { createSlice } from '@reduxjs/toolkit';

import { initialQueryVariablesState, QueryVariablesState } from './queryVariablesReducer';
import { VariableType } from '../variable';
import { addVariable, updateVariableOptions, updateVariableTags } from './actions';
import { variableAdapter } from '../adapters';

export interface TemplatingState extends Record<VariableType, any> {
  query: QueryVariablesState;
}

export const initialState = {
  query: initialQueryVariablesState,
};

const templatingSlice = createSlice({
  name: 'templating',
  initialState,
  reducers: {},
  extraReducers: builder =>
    builder
      .addCase(addVariable, (state: TemplatingState, action) => {
        const { type } = action.payload.model;
        const reducer = variableAdapter[type].getReducer();
        if (!reducer) {
          throw new Error(`Reducer for type ${type} could not be found.`);
        }
        state[type] = reducer(state[type], action);
      })
      .addCase(updateVariableOptions, (state: TemplatingState, action) => {
        const { type } = action.payload.variable;
        const reducer = variableAdapter[type].getReducer();
        if (!reducer) {
          throw new Error(`Reducer for type ${type} could not be found.`);
        }
        state[type] = reducer(state[type], action);
      })
      .addCase(updateVariableTags, (state: TemplatingState, action) => {
        const { type } = action.payload.variable;
        const reducer = variableAdapter[type].getReducer();
        if (!reducer) {
          throw new Error(`Reducer for type ${type} could not be found.`);
        }
        state[type] = reducer(state[type], action);
      }),
});

export const templatingReducer = templatingSlice.reducer;

export default {
  templating: templatingReducer,
};
