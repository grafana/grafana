import { createSlice } from '@reduxjs/toolkit';

import { SwitchVariableModel } from '@grafana/data';

import { initialVariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialSwitchVariableModelState: SwitchVariableModel = {
  ...initialVariableModelState,
  type: 'switch',
  query: '',
  current: {
    selected: true,
    text: 'false',
    value: 'false',
  },
  options: [
    {
      selected: true,
      text: 'true',
      value: 'true',
    },
    {
      selected: false,
      text: 'false',
      value: 'false',
    },
  ],
};

export const switchVariableSlice = createSlice({
  name: 'templating/switch',
  initialState: initialVariablesState,
  reducers: {},
});

export const switchVariableReducer = switchVariableSlice.reducer;
