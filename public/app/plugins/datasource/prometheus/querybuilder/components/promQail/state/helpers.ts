import { AnyAction } from 'redux';

import { Interaction, QuerySuggestion, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';

// actions to update the state
const { updateInteraction } = stateSlice.actions;

export const querySuggestions: QuerySuggestion[] = [
  {
    query: 'up{instance="localhost:3000"}',
    explanation: '',
  },
  // {
  //   query: 'up{instance="localhost:3000"}',
  //   explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  // },
  // {
  //   query: 'up{instance="localhost:3000"}',
  //   explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  // },
  // {
  //   query: 'up{instance="localhost:3000"}',
  //   explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  // },
  // {
  //   query: 'up{instance="localhost:3000"}',
  //   explanation: 'This query is measuring a certain amount of things. It will help you know that your service is up.',
  // },
];

/**
 * Calls the API and adds suggestions to the interaction
 *
 * @param dispatch
 * @param idx
 * @param interaction
 * @returns
 */
export async function promQailExplain(dispatch: React.Dispatch<AnyAction>, idx: number, interaction: Interaction) {
  // HISTORICAL RESPONSE
  new Promise<void>((resolve) => {
    return setTimeout(() => {
      const interactionToUpdate = interaction;

      const payload = {
        idx,
        interaction: {
          ...interactionToUpdate,
          isLoading: false,
          suggestions: [
            {
              query: interactionToUpdate.suggestions[0].query,
              explanation: 'this is the AI explanation.',
            },
          ],
        },
        explanation: 'Here is an explanation.',
      };
      dispatch(updateInteraction(payload));
      resolve();
    }, 1); // so fast!
  });
  // let url = "http://localhost:5001"

  // const checkService = await fetch(url).then((resp)=> resp.text());

  // if (
  //   checkService !== "success"
  // ) {
  //   console.warn("PromQail service is not up.");
  //   const interactionToUpdate = interaction;
  //   interactionToUpdate.suggestions[0].explanation = "This might be a Prometheus query or something else. We're not sure because the PromQail service is not up.";
  //   const payload = {
  //     idx,
  //     interaction: {
  //       ...interactionToUpdate,
  //       isLoading: false,
  //     },
  //   };

  //   dispatch(updateInteraction(payload));
  // } else if (checkService === "success") {
  //   url += "/query-explainer";
  //   // PROMQAIL ENDPOINTS
  //   // /query-explainer
  //   // takes a prom query returns an explanation
  //   // '{"query": "sum by (thing) (metric)"}'

  //   // /metric-search
  //   // takes a prompt returns a metric
  //   // '{"query": "frontend error rate"}'
  //   const query = interaction?.suggestions[idx].query;

  //   const body = {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({query: query}),
  //   }

  //   const promQailPromise = fetch(url, body);

  //   const promQailResp = await promQailPromise.then((resp)=> {
  //     return resp.text();
  //   }).then((data) =>{
  //     return {data:data, error: false};
  //   }).catch((error) => {
  //     return {error:error} ;
  //   });

  //   if (promQailResp.error) {
  //     console.warn(promQailResp.error);
  //   } else {
  //     const interactionToUpdate = interaction;
  //     // switch to returning 1 query until we get more confidence returning more
  //     // const explanation = promQailResp

  //     // interactionToUpdate.suggestions[0].explanation = explanation;

  //     const payload = {
  //       idx,
  //       interaction: {
  //         ...interactionToUpdate,
  //         suggestions: interactionToUpdate.suggestions,
  //         isLoading: false,
  //       },
  //     };

  //     dispatch(updateInteraction(payload));
  //   }
  // }
}

/**
 * Calls the API and adds suggestions to the interaction
 *
 * @param dispatch
 * @param idx
 * @param interaction
 * @returns
 */
export async function promQailSuggest(
  dispatch: React.Dispatch<AnyAction>,
  idx: number,
  endpoint?: string,
  interaction?: Interaction
) {
  // HISTORICAL RESPONSE
  new Promise<void>((resolve) => {
    return setTimeout(() => {
      const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

      const payload = {
        idx,
        interaction: { ...interactionToUpdate, suggestions: querySuggestions, isLoading: false },
      };
      dispatch(updateInteraction(payload));
      resolve();
    }, 1000);
  });

  // if (!interaction) {
  //   const interactionToUpdate = createInteraction(SuggestionType.Historical);

  //   const payload = {
  //     idx,
  //     interaction: { ...interactionToUpdate, suggestions: querySuggestions, isLoading: false },
  //   };
  //   dispatch(updateInteraction(payload));

  // } else if (interaction) {
  //   const interactionToUpdate = interaction;

  //   const payload = {
  //     idx,
  //     interaction: { ...interactionToUpdate, suggestions: querySuggestions, isLoading: false },
  //   };
  //   dispatch(updateInteraction(payload));
  // }
  // else {
  //   let url = "http://localhost:5001"

  //   const checkService = await fetch(url).then((resp)=> resp.text());

  //   if (
  //     checkService !== "success" &&
  //     interaction?.suggestionType === SuggestionType.AI &&
  //     endpoint !== "/querysuggest"
  //   ) {
  //     console.warn("PromQail service is not up. Please check what you're doing. Here's some historical queries.");
  //     const interactionToUpdate = interaction;

  //     const payload = {
  //       idx,
  //       interaction: {
  //         ...interactionToUpdate,
  //         suggestions: querySuggestions,
  //         isLoading: false,
  //         suggestionType: SuggestionType.Historical,
  //         prompt: "Service down."
  //       },
  //     };

  //     dispatch(updateInteraction(payload));
  //   } else if (
  //     checkService === "success" &&
  //     interaction?.suggestionType === SuggestionType.AI &&
  //     endpoint !== "/querysuggest"
  //   ) {
  //     // PROMQAIL ENDPOINTS
  //     // /query-explainer
  //     // takes a prom query returns an explanation
  //     // '{"query": "sum by (thing) (metric)"}'

  //     // /metric-search
  //     // takes a prompt returns a metric
  //     // '{"query": "frontend error rate"}'

  //     const query = interaction?.suggestions[idx].query;

  //     const body = {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({query: query}),
  //     }

  //     const promQailPromise = fetch(url+endpoint, body);

  //     const promQailResp = await promQailPromise.then((resp)=> {
  //       return resp.json()
  //     }).catch((error) => {
  //       return {error:error}
  //     });

  //     if (promQailResp.error) {
  //       console.warn(promQailResp.error);
  //     } else {
  //       const interactionToUpdate = interaction;
  //       // switch to returning 1 query until we get more confidence returning more
  //       const suggestions = [promQailResp?.something];

  //       interactionToUpdate.suggestions = suggestions;

  //       const payload = {
  //         idx,
  //         interaction: {
  //           ...interactionToUpdate,
  //           isLoading: false,
  //         },
  //       };

  //       dispatch(updateInteraction(payload));
  //     }
  //   }
  // }
}
