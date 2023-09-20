export type QuerySuggestion = {
  query: string;
  explanation: string;
};

export enum SuggestionType {
  Historical = 'historical',
  AI = 'AI',
}

export type Interaction = {
  prompt: string;
  suggestionType: SuggestionType;
  suggestions: QuerySuggestion[];
  isLoading: boolean;
  explanationIsLoading: boolean;
};


export type SimpleSuggestionData = {
  metric: string;
  templatedExpr: string;
  count: number;
  topLabelValues: { [key: string]: number };
  topLabelNoValues: { [key: string]: number };
  createdAt: number;
};

export type SimpleSuggestionResult = {
  result: SimpleSuggestionData[];
};