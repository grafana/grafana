import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { PromVisualQuery } from '../../../types';

export const stateSlice = createSlice({
  name: 'metrics-modal-state',
  initialState: initialState(),
  reducers: {
    showExplainer: (state, action: PayloadAction<boolean>) => {
      state.showExplainer = action.payload;
    },
    showStartingMessage: (state, action: PayloadAction<boolean>) => {
      state.showStartingMessage = action.payload;
    },
  },
});

/**
 * Initial state for PromQAIL
 * @param query the prometheus query with metric and possible labels
 */
export function initialState(query?: PromVisualQuery): PromQailState {
  return {
    query: query ?? {
      metric: '',
      labels: [],
      operations: [],
    },
    showExplainer: false,
    showStartingMessage: true,
  };
}

/**
 * The PromQAIL state object
 */
export interface PromQailState {
  query: PromVisualQuery;
  showExplainer: boolean;
  showStartingMessage: boolean;
}
