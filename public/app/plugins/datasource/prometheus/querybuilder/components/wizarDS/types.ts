export type Suggestion = {
  component: string;
  explanation: string;
  testid: string;
  order: number;
};

export enum SuggestionType {
  // historical is the full list, rename this more generic
  Historical = 'historical',
  AI = 'AI',
}

export type Interaction = {
  prompt: string;
  suggestionType: SuggestionType;
  suggestions: Suggestion[];
  isLoading: boolean;
  explanationIsLoading: boolean;
};
