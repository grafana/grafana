import { initialQueryVariablesState, queryVariablesReducer, QueryVariablesState } from './queryVariable';
import { createSlice } from '@reduxjs/toolkit';
import { VariableType } from '../variable';
import { addVariable } from './actions';

export interface TemplatingState extends Record<VariableType, any> {
  query: QueryVariablesState;
}

export const initialState = {
  query: initialQueryVariablesState,
};

export const getReducerFromType = (type: VariableType) => {
  if (type === 'query') {
    return queryVariablesReducer;
  }

  return null;
};

const templatingSlice = createSlice({
  name: 'templating',
  initialState,
  reducers: {},
  extraReducers: builder =>
    builder.addCase(addVariable, (state: TemplatingState, action) => {
      const { type } = action.payload.model;
      const reducer = getReducerFromType(type);
      if (!reducer) {
        return;
      }
      state[type] = reducer(state[type], action);
    }),
});

export const templatingReducer = templatingSlice.reducer;

export default {
  templating: templatingReducer,
};
