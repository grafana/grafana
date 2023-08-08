import { AnyAction } from 'redux';

import { QuerySuggestion } from '../types';

import { stateSlice } from './state';

// actions to update the state
const { aiIsLoading, giveMeAIQueries } = stateSlice.actions;

export const querySuggestions: QuerySuggestion[] = [
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
];

export async function callOpenAI(dispatch: React.Dispatch<AnyAction>, prompt?: string): Promise<QuerySuggestion[]> {
  const prom = new Promise<QuerySuggestion[]>((resolve) => {
    return setTimeout(() => {
      console.log(prompt ?? 'no prompt given');
      resolve(querySuggestions);
      dispatch(aiIsLoading(false));
      dispatch(giveMeAIQueries(true));
    }, 3000);
  });

  const data: QuerySuggestion[] = await prom;

  return data;
}
