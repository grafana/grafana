import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConstantVariableModel, VariableHide, VariableOption } from '../types';
import { getInstanceState, NEW_VARIABLE_ID, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialConstantVariableModelState: ConstantVariableModel = {
  id: NEW_VARIABLE_ID,
  global: false,
  type: 'constant',
  name: '',
  hide: VariableHide.hideVariable,
  label: '',
  query: '',
  current: {} as VariableOption,
  options: [],
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const constantVariableSlice = createSlice({
  name: 'templating/constant',
  initialState: initialVariablesState,
  reducers: {
    createConstantOptionsFromQuery: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<ConstantVariableModel>(state, action.payload.id);
      instanceState.options = [
        { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false },
      ];
    },
  },
});

export const constantVariableReducer = constantVariableSlice.reducer;

export const { createConstantOptionsFromQuery } = constantVariableSlice.actions;
