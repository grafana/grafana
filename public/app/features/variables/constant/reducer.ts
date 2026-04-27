import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type ConstantVariableModel, VariableHide, type VariableOption } from '@grafana/data/types';

import { getInstanceState } from '../state/getInstanceState';
import { initialVariablesState, type VariablePayload, type VariablesState } from '../state/types';
import { initialVariableModelState } from '../types';

export const initialConstantVariableModelState: ConstantVariableModel = {
  ...initialVariableModelState,
  type: 'constant',
  hide: VariableHide.hideVariable,
  query: '',
  current: {} as VariableOption,
  options: [],
};

export const constantVariableSlice = createSlice({
  name: 'templating/constant',
  initialState: initialVariablesState,
  reducers: {
    createConstantOptionsFromQuery: (state: VariablesState, action: PayloadAction<VariablePayload>) => {
      const instanceState = getInstanceState(state, action.payload.id);
      if (instanceState.type !== 'constant') {
        return;
      }

      instanceState.options = [
        { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false },
      ];
    },
  },
});

export const constantVariableReducer = constantVariableSlice.reducer;

export const { createConstantOptionsFromQuery } = constantVariableSlice.actions;
