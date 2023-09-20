import { AnyAction } from 'redux';

import { getBackendSrv } from '@grafana/runtime';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp } from 'app/plugins/datasource/prometheus/language_provider';

// import { promQueryModeller } from '../../../PromQueryModeller';
import { buildVisualQueryFromString } from '../../../parsing';
import { PromVisualQuery } from '../../../types';
import { Interaction, QuerySuggestion, SimpleSuggestionResult, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';


// actions to update the state
const { updateInteraction } = stateSlice.actions;

export const querySuggestions: QuerySuggestion[] = [
  {
    query: 'min(mlapi_http_requests_total{instance="localhost:3005"})',
    explanation: '',
  },
  {
    query: 'sum(mlapi_http_requests_total{instance="localhost:3005"})',
    explanation: '',
  },
  {
    query: 'avg(mlapi_http_requests_total{job="go-app"})',
    explanation: '',
  },
  {
    query: 'mlapi_http_requests_total{job="go-app"}',
    explanation: '',
  },
  {
    query: 'mlapi_http_requests_total{instance="localhost:3005"}',
    explanation: '',
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
export async function promQailExplain(
  dispatch: React.Dispatch<AnyAction>,
  idx: number,
  query: PromVisualQuery,
  interaction: Interaction,
  suggIdx: number,
  datasource: PrometheusDatasource
) {
  const check = await promQailHealthcheck();

  // no api hooked up?
  if (!check) {
    new Promise<void>((resolve) => {
      return setTimeout(() => {
        // REFACTOR
        const interactionToUpdate = interaction;

        const explanation = 'This is a filler explanation because the api is not hooked up.';

        const updatedSuggestions = interactionToUpdate.suggestions.map((sg: QuerySuggestion, sidx: number) => {
          if (suggIdx === sidx) {
            return {
              query: interactionToUpdate.suggestions[suggIdx].query,
              explanation: explanation,
            };
          }

          return sg;
        });

        const payload = {
          idx,
          interaction: {
            ...interactionToUpdate,
            suggestions: updatedSuggestions,
            explanationIsLoading: false,
          },
        };

        dispatch(updateInteraction(payload));
        resolve();
      }, 1); // so fast!
    });
  } else {
    const url = 'http://localhost:5001/query-explainer';

    const suggestedQuery = interaction.suggestions[suggIdx].query;

    let metricMetadata: string | undefined;

    if (datasource.languageProvider.metricsMetadata) {
      if (interaction.suggestionType === SuggestionType.Historical) {
        // parse the suggested query
        // get the metric
        // then check the metadata
        const pvq = buildVisualQueryFromString(suggestedQuery);
        metricMetadata = getMetadataHelp(pvq.query.metric, datasource.languageProvider.metricsMetadata!);
      } else {
        // for the AI we already have a metric selected
        metricMetadata = getMetadataHelp(query.metric, datasource.languageProvider.metricsMetadata!);
      }
    }

    const body = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: suggestedQuery, metric: query.metric, description: metricMetadata ?? '' }),
    };

    const promQailPromise = fetch(url, body);

    const promQailResp = await promQailPromise
      .then((resp) => {
        return resp.json();
      })
      .then((data) => {
        return data;
      })
      .catch((error) => {
        return { error: error };
      });

    const interactionToUpdate = interaction;
    // switch to returning 1 query until we get more confidence returning more
    const explanation = promQailResp.response;

    const updatedSuggestions = interactionToUpdate.suggestions.map((sg: QuerySuggestion, sidx: number) => {
      if (suggIdx === sidx) {
        return {
          query: interactionToUpdate.suggestions[suggIdx].query,
          explanation: explanation,
        };
      }

      return sg;
    });

    const payload = {
      idx,
      interaction: {
        ...interactionToUpdate,
        suggestions: updatedSuggestions,
        explanationIsLoading: false,
      },
    };

    dispatch(updateInteraction(payload));
  }
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
  query: PromVisualQuery,
  interaction?: Interaction
) {

  let suggestions: QuerySuggestion[];

  if (interaction?.suggestionType === SuggestionType.AI) {
    suggestions = [
      {
        query: 'LLM suggestion is not yet implemented',
        explanation: 'LLM suggestion is not yet implemented',
      }
    ];
  } else {
    const promQailResp = await getSimpleQuerySuggestion(query);
    suggestions = promQailResp.result.map(data => {
      return {
        query: data.templatedExpr,
        explanation: '',
      };
    });
  }

  const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

  const payload = {
    idx,
    interaction: {
      ...interactionToUpdate,
      suggestions: suggestions,
      isLoading: false,
    },
  };

  dispatch(updateInteraction(payload));

  
}

async function getSimpleQuerySuggestion(query: PromVisualQuery) {
  const datasourceType = 'prometheus';
  let params = `datasourceType=${datasourceType}&metric=${query.metric}`;

  const simpleSuggestion: SimpleSuggestionResult = await getBackendSrv().get(`/api/query-recommend?${params}`);

  return simpleSuggestion;
}

async function promQailHealthcheck() {
  const resp = await fetch('http://localhost:5001')
    .then((resp) => resp.text())
    .then((data) => data)
    .catch((error) => error);

  return resp === 'success';
}
