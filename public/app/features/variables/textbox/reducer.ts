import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { TextBoxVariableModel } from '@grafana/data';

import { getInstanceState } from '../state/selectors';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialTextBoxVariableModelState: TextBoxVariableModel = {
  ...initialVariableModelState,
  type: 'textbox',
  query: '',
  current: {},
  options: [],
  originalQuery: null,
};

export const textBoxVariableSlice = createSlice({
  name: 'templating/textbox',
  initialState: initialVariablesState,
  reducers: {
    createTextBoxOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'textbox') {
        return;
      }

      const option = { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false };
      instanceState.options = [option];
      instanceState.current = option;
    },
  },
});

export const textBoxVariableReducer = textBoxVariableSlice.reducer;

export const { createTextBoxOptions } = textBoxVariableSlice.actions;
