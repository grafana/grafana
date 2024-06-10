import { PromVisualQuery } from '../../../types';
import { Interaction, SuggestionType } from '../types';

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
