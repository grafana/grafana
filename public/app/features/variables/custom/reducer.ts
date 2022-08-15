import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { CustomVariableModel, initialVariableModelState, VariableOption } from '../types';

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
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'custom') {
        return;
      }

      const { includeAll, query } = instanceState;

      const match = query.match(/(?:\\,|[^,])+/g) ?? [];
      const options = match.map((text) => {
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
