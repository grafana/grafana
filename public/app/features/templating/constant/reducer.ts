import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConstantVariableModel, VariableHide, VariableOption } from '../variable';
import { EMPTY_UUID, getInstanceState, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialConstantVariableModelState: ConstantVariableModel = {
  uuid: EMPTY_UUID,
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
      const instanceState = getInstanceState<ConstantVariableModel>(state, action.payload.uuid);
      instanceState.options = [
        { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false },
      ];
    },
  },
});

export const constantVariableReducer = constantVariableSlice.reducer;

export const { createConstantOptionsFromQuery } = constantVariableSlice.actions;
