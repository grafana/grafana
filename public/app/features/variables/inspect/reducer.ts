import { UsagesToNetwork, VariableUsageTree } from './utils';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface VariableInspectState {
  unknown: VariableUsageTree[];
  usages: VariableUsageTree[];
  unknownsNetwork: UsagesToNetwork[];
  usagesNetwork: UsagesToNetwork[];
  unknownExits: boolean;
}

export const initialVariableInspectState: VariableInspectState = {
  unknown: [],
  usages: [],
  unknownsNetwork: [],
  usagesNetwork: [],
  unknownExits: false,
};

const variableInspectReducerSlice = createSlice({
  name: 'templating/inspect',
  initialState: initialVariableInspectState,
  reducers: {
    initInspect: (
      state,
      action: PayloadAction<{
        unknown: VariableUsageTree[];
        usages: VariableUsageTree[];
        unknownsNetwork: UsagesToNetwork[];
        usagesNetwork: UsagesToNetwork[];
        unknownExits: boolean;
      }>
    ) => {
      const { unknown, usages, unknownExits, unknownsNetwork, usagesNetwork } = action.payload;
      state.usages = usages;
      state.unknown = unknown;
      state.unknownsNetwork = unknownsNetwork;
      state.unknownExits = unknownExits;
      state.usagesNetwork = usagesNetwork;
    },
  },
});

export const variableInspectReducer = variableInspectReducerSlice.reducer;

export const { initInspect } = variableInspectReducerSlice.actions;
