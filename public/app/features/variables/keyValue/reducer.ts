import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getInstanceState } from '../state/selectors';
import { initialVariablesState, VariablePayload, VariablesState } from '../state/types';
import { KeyValueVariableModel, initialVariableModelState, VariableHide } from '../types';

export const initialKeyValueVariableModelState: KeyValueVariableModel = {
  ...initialVariableModelState,
  type: 'keyValue',
  hide: VariableHide.hideVariable,
  key: '',
  query: '',
  current: { text: '', selected: false, value: '' },
  options: [],
};

interface KeyValueVariablePayload {
  key: string;
  value: string | null;
}

export const constantVariableSlice = createSlice({
  name: 'templating/keyValue',
  initialState: initialVariablesState,
  reducers: {
    updateKeyValueVariable: (
      state: VariablesState,
      action: PayloadAction<VariablePayload<KeyValueVariablePayload>>
    ) => {
      const instanceState = getInstanceState<KeyValueVariableModel>(state, action.payload.id);
      instanceState.key = action.payload.data.key;
      instanceState.current = {
        selected: false,
        text: action.payload.data.value || '',
        value: action.payload.data.value || '',
      };
    },
  },
});

export const constantVariableReducer = constantVariableSlice.reducer;

export const { updateKeyValueVariable } = constantVariableSlice.actions;
