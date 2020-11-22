import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { CustomVariableModel, initialVariableModelState, VariableOption } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, getInstanceState, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialCustomVariableModelState: CustomVariableModel = {
  ...initialVariableModelState,
  type: 'custom',
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
};

export const customVariableSlice = createSlice({
  name: 'templating/custom',
  initialState: initialVariablesState,
  reducers: {
    createCustomOptionsFromQuery: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<CustomVariableModel>(state, action.payload.id);
      const { includeAll, query } = instanceState;

      const match = query.match(/(?:\\,|[^,])+/g) ?? [];
      const options = match.map(text => {
        text = text.replace(/\\,/g, ',');
        const textMatch = /^(.+)\s:\s(.+)$/g.exec(text) ?? [];
        if (textMatch.length === 3) {
          const [, key, value] = textMatch;
          return { text: key.trim(), value: value.trim(), selected: false };
        } else {
          return { text: text.trim(), value: text.trim(), selected: false };
        }
      });

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.options = options;
    },
  },
});

export const customVariableReducer = customVariableSlice.reducer;

export const { createCustomOptionsFromQuery } = customVariableSlice.actions;
