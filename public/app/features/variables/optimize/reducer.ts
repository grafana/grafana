import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { OptimizeVariableModel } from '@grafana/data';

import { getInstanceState } from '../state/selectors';
import { VariablePayload, initialVariablesState, VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialOptimizeVariableModelState: OptimizeVariableModel = {
  ...initialVariableModelState,
  type: 'optimizepicker',
  definition: 'Domain filter',
  query: '',
  current: {},
  options: [],
  originalQuery: null,
};

export const OptimizeVariableSlice = createSlice({
  name: 'tempating/optimizepicker',
  initialState: initialVariablesState,
  reducers: {
    createOptimizeOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'optimizepicker') {
        return;
      }
      const option = {
        text: instanceState.query.trim(),
        value: instanceState.query.trim(),
        selected: false,
      };
      instanceState.options = [option];
      instanceState.current = option;
    },
  },
});

export const OptimizeVariableReducer = OptimizeVariableSlice.reducer;

export const { createOptimizeOptions } = OptimizeVariableSlice.actions;
