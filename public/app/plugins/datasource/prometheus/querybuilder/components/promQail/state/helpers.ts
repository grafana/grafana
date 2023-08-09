import { AnyAction } from 'redux';

import { Interaction, QuerySuggestion, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';

// actions to update the state
const { aiIsLoading, updateInteraction } = stateSlice.actions;

export const querySuggestions: QuerySuggestion[] = [
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
  {
    query: 'up{instance="localhost:3000"}',
    explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  },
];

/**
 * Calls the API and adds suggestions to the interaction
 *
 * @param dispatch
 * @param idx
 * @param interaction
 * @returns
 */
export async function callOpenAI(
  dispatch: React.Dispatch<AnyAction>,
  idx: number,
  interaction?: Interaction
): Promise<QuerySuggestion[]> {
  const prom = new Promise<QuerySuggestion[]>((resolve) => {
    return setTimeout(() => {
      console.log(prompt ?? 'no prompt given');
      resolve(querySuggestions);
      dispatch(aiIsLoading(false));

      const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

      const payload = {
        idx,
        interaction: { ...interactionToUpdate, suggestions: querySuggestions },
      };
      dispatch(updateInteraction(payload));
      // dispatch(giveMeAIQueries(true));
    }, 1000);
  });

  const data: QuerySuggestion[] = await prom;

  return data;
}
