import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AdHocVariableFilter, AdHocVariableModel, initialVariableModelState } from 'app/features/variables/types';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { getInstanceState } from '../state/selectors';

export interface AdHocVariabelFilterUpdate {
  index: number;
  filter: AdHocVariableFilter;
}

export const initialAdHocVariableModelState: AdHocVariableModel = {
  ...initialVariableModelState,
  type: 'adhoc',
  datasource: null,
  filters: [],
};

export const adHocVariableSlice = createSlice({
  name: 'templating/adhoc',
  initialState: initialVariablesState,
  reducers: {
    filterAdded: (state: VariablesState, action: PayloadAction<VariablePayload<AdHocVariableFilter>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.id);
      instanceState.filters.push(action.payload.data);
    },
    filterRemoved: (state: VariablesState, action: PayloadAction<VariablePayload<number>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.id);
      const index = action.payload.data;

      instanceState.filters.splice(index, 1);
    },
    filterUpdated: (state: VariablesState, action: PayloadAction<VariablePayload<AdHocVariabelFilterUpdate>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.id);
      const { filter, index } = action.payload.data;

      instanceState.filters[index] = filter;
    },
    filtersRestored: (state: VariablesState, action: PayloadAction<VariablePayload<AdHocVariableFilter[]>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.id);
      instanceState.filters = action.payload.data;
    },
  },
});

export const { filterAdded, filterRemoved, filterUpdated, filtersRestored } = adHocVariableSlice.actions;
export const adHocVariableReducer = adHocVariableSlice.reducer;
