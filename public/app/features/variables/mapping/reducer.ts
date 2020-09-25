import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { MappingVariableModel, VariableHide, VariableOption } from '../types';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  getInstanceState,
  NEW_VARIABLE_ID,
  VariablePayload,
} from '../state/types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export const initialMappingVariableModelState: MappingVariableModel = {
  id: NEW_VARIABLE_ID,
  global: false,
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
  name: '',
  type: 'mapping',
  label: null,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const mappingVariableSlice = createSlice({
  name: 'templating/mapping',
  initialState: initialVariablesState,
  reducers: {
    createMappingOptionsFromQuery: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState<MappingVariableModel>(state, action.payload.id);
      const { includeAll, query } = instanceState;
      const match = query.match(/(?:\\,|[^,])+/g) ?? [];

      const options = match.map(text => {
        text = text.replace(/\\,/g, ',');
        const [key, value] = text.split(':');
        console.log('mapping reducer key ', key);
        console.log('mapping reducer value ', value);
        return { text: key.trim(), value: value.trim(), selected: false };
      });

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.options = options;
    },
  },
});

export const mappingVariableReducer = mappingVariableSlice.reducer;

export const { createMappingOptionsFromQuery } = mappingVariableSlice.actions;
