// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/promQail/types.ts
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
