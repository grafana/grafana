import { Step } from 'app/features/tutorial/types';

export type Suggestion = Step & {
  component: string;
  explanation: string;
  testid: string;
  link: string;
  order: number;

  // update attrinbutes for Tutotial
  // route: string;
  // target: string;
  // title: string;
  // content: string;
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
