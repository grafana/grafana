import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { PromVisualQuery } from '../../../types';
import { Interaction, SuggestionType } from '../types';

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
    /*
     * start working on a collection of interactions
     * {
     *  askForhelp y n
     *  prompt question
     *  queries querySuggestions
     * }
     *
     */
    addInteraction: (state, action: PayloadAction<{ suggestionType: SuggestionType; isLoading: boolean }>) => {
      // AI or Historical?
      const interaction = createInteraction(action.payload.suggestionType, action.payload.isLoading);
      const interactions = state.interactions;
      state.interactions = interactions.concat([interaction]);
    },
    updateInteraction: (state, action: PayloadAction<{ idx: number; interaction: Interaction }>) => {
      // update the interaction by index
      // will most likely be the last interaction but we might update previous by giving them cues of helpful or not
      const index = action.payload.idx;
      const updInteraction = action.payload.interaction;

      state.interactions = state.interactions.map((interaction: Interaction, idx: number) => {
        if (idx === index) {
          return updInteraction;
        }

        return interaction;
      });
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
    interactions: [],
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
  interactions: Interaction[];
}

export function createInteraction(suggestionType: SuggestionType, isLoading?: boolean): Interaction {
  return {
    suggestionType: suggestionType,
    prompt: '',
    suggestions: [],
    isLoading: isLoading ?? false,
    explanationIsLoading: false,
  };
}
