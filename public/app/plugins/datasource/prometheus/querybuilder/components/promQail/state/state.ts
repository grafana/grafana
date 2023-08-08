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
    indicateCheckbox: (state, action: PayloadAction<boolean>) => {
      state.indicateCheckbox = action.payload;
    },
    askForQueryHelp: (state, action: PayloadAction<boolean>) => {
      state.askForQueryHelp = action.payload;
    },
    knowWhatYouWantToQuery: (state, action: PayloadAction<boolean>) => {
      state.knowWhatYouWantToQuery = action.payload;
    },
    promptKnowWhatToSeeWithMetric: (state, action: PayloadAction<string>) => {
      state.promptKnowWhatToSeeWithMetric = action.payload;
    },
    aiIsLoading: (state, action: PayloadAction<boolean>) => {
      state.aiIsLoading = action.payload;
    },
    giveMeAIQueries: (state, action: PayloadAction<boolean>) => {
      state.giveMeAIQueries = action.payload;
    },
    giveMeHistoricalQueries: (state, action: PayloadAction<boolean>) => {
      state.aiIsLoading = action.payload;
    },
  },
});

/**
 * Initial state for PromQAIL
 * @param query the prometheus query with metric and possible labels
 */
export function initialState(query?: PromVisualQuery, showStartingMessage?: boolean): PromQailState {
  return {
    query: query ?? {
      metric: '',
      labels: [],
      operations: [],
    },
    showExplainer: false,
    showStartingMessage: showStartingMessage ?? true,
    indicateCheckbox: false,
    askForQueryHelp: false,
    knowWhatYouWantToQuery: false,
    promptKnowWhatToSeeWithMetric: '',
    aiIsLoading: false,
    giveMeAIQueries: false,
    giveMeHistoricalQueries: false,
  };
}

/**
 * The PromQAIL state object
 */
export interface PromQailState {
  query: PromVisualQuery;
  showExplainer: boolean;
  showStartingMessage: boolean;
  indicateCheckbox: boolean;
  askForQueryHelp: boolean;
  knowWhatYouWantToQuery: boolean;
  promptKnowWhatToSeeWithMetric: string;
  aiIsLoading: boolean;
  giveMeAIQueries: boolean;
  giveMeHistoricalQueries: boolean;
}
