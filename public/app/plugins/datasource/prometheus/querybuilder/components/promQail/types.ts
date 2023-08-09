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
  needHelp: boolean;
  suggestions: QuerySuggestion[];
};
