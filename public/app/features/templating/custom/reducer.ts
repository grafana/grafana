import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { CustomVariableModel, VariableHide, VariableOption } from '../variable';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, EMPTY_UUID, getInstanceState, VariablePayload } from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialCustomVariableModelState: CustomVariableModel = {
  uuid: EMPTY_UUID,
  global: false,
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
  name: '',
  type: 'custom',
  label: null,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const customVariableSlice = createSlice({
  name: 'templating/custom',
  initialState: initialVariablesState,
  reducers: {
    createCustomOptionsFromQuery: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<CustomVariableModel>(state, action.payload.uuid);
      const { includeAll, query } = instanceState;
      const match = query.match(/(?:\\,|[^,])+/g) ?? [];

      const options = match.map(text => {
        text = text.replace(/\\,/g, ',');
        return { text: text.trim(), value: text.trim(), selected: false };
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
