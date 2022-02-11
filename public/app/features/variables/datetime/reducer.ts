import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { initialVariableModelState, DateTimeVariableModel, VariableOption } from '../types';
import { getInstanceState, VariablePayload, initialVariablesState, VariablesState } from '../state/types';

export const initialDateTimeVariableModelState: DateTimeVariableModel = {
  ...initialVariableModelState,
  type: 'datetime',
  query: new Date().valueOf().toString(),
  current: {} as VariableOption,
  options: [],
};

export const dateTimeVariableSlice = createSlice({
  name: 'templating/datetime',
  initialState: initialVariablesState,
  reducers: {
    createDateTimeOptions: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<DateTimeVariableModel>(state, action.payload.id);
      const option = { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false };
      instanceState.current = option;
      if (instanceState.returnValue === 'end') {
        instanceState.options = [option];
      } else {
        instanceState.options = [];
      }
    },
  },
});

export const dateTimeVariableReducer = dateTimeVariableSlice.reducer;

export const { createDateTimeOptions } = dateTimeVariableSlice.actions;
