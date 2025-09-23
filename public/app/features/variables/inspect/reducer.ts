import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { UsagesToNetwork, VariableUsageTree } from './utils';

export interface VariableInspectState {
  usages: VariableUsageTree[];
  usagesNetwork: UsagesToNetwork[];
}

export const initialVariableInspectState: VariableInspectState = {
  usages: [],
  usagesNetwork: [],
};

const variableInspectReducerSlice = createSlice({
  name: 'templating/inspect',
  initialState: initialVariableInspectState,
  reducers: {
    initInspect: (state, action: PayloadAction<{ usages: VariableUsageTree[]; usagesNetwork: UsagesToNetwork[] }>) => {
      const { usages, usagesNetwork } = action.payload;
      state.usages = usages;
      state.usagesNetwork = usagesNetwork;
    },
  },
});

export const variableInspectReducer = variableInspectReducerSlice.reducer;

export const { initInspect } = variableInspectReducerSlice.actions;
