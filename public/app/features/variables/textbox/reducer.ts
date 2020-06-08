import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { TextBoxVariableModel, VariableHide, VariableOption } from '../types';
import { getInstanceState, NEW_VARIABLE_ID, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialTextBoxVariableModelState: TextBoxVariableModel = {
  id: NEW_VARIABLE_ID,
  global: false,
  index: -1,
  type: 'textbox',
  name: '',
  label: '',
  hide: VariableHide.dontHide,
  query: '',
  current: {} as VariableOption,
  options: [],
  skipUrlSync: false,
  initLock: null,
};

export const textBoxVariableSlice = createSlice({
  name: 'templating/textbox',
  initialState: initialVariablesState,
  reducers: {
    createTextBoxOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<TextBoxVariableModel>(state, action.payload.id);
      const option = { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false };
      instanceState.options = [option];
      instanceState.current = option;
    },
  },
});

export const textBoxVariableReducer = textBoxVariableSlice.reducer;

export const { createTextBoxOptions } = textBoxVariableSlice.actions;
