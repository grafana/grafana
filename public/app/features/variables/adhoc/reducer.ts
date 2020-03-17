import { AdHocVariableModel, VariableHide, AdHocVariableFilter } from 'app/features/templating/variable';
import { EMPTY_UUID, getInstanceState, VariablePayload } from '../state/types';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { VariablesState, initialVariablesState } from '../state/variablesReducer';

export interface AdHocVariabelFilterUpdate {
  index: number;
  filter: AdHocVariableFilter;
}
export interface AdHocVariableEditorState {
  dataSources: Array<{ text: string; value: string }>;
}

export const initialAdHocVariableModelState: AdHocVariableModel = {
  uuid: EMPTY_UUID,
  global: false,
  type: 'adhoc',
  name: '',
  hide: VariableHide.dontHide,
  label: '',
  skipUrlSync: false,
  index: -1,
  initLock: null,
  datasource: null,
  filters: [],
};

export const adHocVariableSlice = createSlice({
  name: 'templating/constant',
  initialState: initialVariablesState,
  reducers: {
    filterAdded: (state: VariablesState, action: PayloadAction<VariablePayload<AdHocVariableFilter>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.uuid);
      instanceState.filters.push(action.payload.data);
    },
    filterRemoved: (state: VariablesState, action: PayloadAction<VariablePayload<number>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.uuid);
      const index = action.payload.data;

      instanceState.filters = instanceState.filters.splice(index, 1);
    },
    filterUpdated: (state: VariablesState, action: PayloadAction<VariablePayload<AdHocVariabelFilterUpdate>>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.uuid);
      const { filter, index } = action.payload.data;

      instanceState.filters[index] = filter;
    },
  },
});

export const { filterAdded, filterRemoved, filterUpdated } = adHocVariableSlice.actions;
export const adHocVariableReducer = adHocVariableSlice.reducer;
