import { AdHocVariableModel, VariableHide } from 'app/features/templating/variable';
import { EMPTY_UUID, getInstanceState, VariablePayload } from '../state/types';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { VariablesState, initialVariablesState } from '../state/variablesReducer';

export interface AdHocVariableEditorState {
  dataSourceTypes: Array<{ text: string; value: string }>;
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
    someAction: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<AdHocVariableModel>(state, action.payload.uuid);
      instanceState.datasource = '';
    },
  },
});

export const adHocVariableReducer = adHocVariableSlice.reducer;

export const { someAction } = adHocVariableSlice.actions;
