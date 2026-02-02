import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DatePickerVariableModel } from '@grafana/data';

import { getInstanceState } from '../state/selectors';
import { VariablePayload, initialVariablesState, VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialDatePickerVariableModelState: DatePickerVariableModel = {
  ...initialVariableModelState,
  type: 'datepicker',
  query: '',
  current: {},
  options: [],
  originalQuery: null,
};

export const DatePickerVariableSlice = createSlice({
  name: 'templating/datepicker',
  initialState: initialVariablesState,
  reducers: {
    createDatePickerOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'datepicker') {
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

export const DatePickerVariableReducer = DatePickerVariableSlice.reducer;

export const { createDatePickerOptions } = DatePickerVariableSlice.actions;
