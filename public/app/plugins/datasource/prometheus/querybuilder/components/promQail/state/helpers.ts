import { AnyAction } from 'redux';

import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp } from 'app/plugins/datasource/prometheus/language_provider';

import { promQueryModeller } from '../../../PromQueryModeller';
import { buildVisualQueryFromString } from '../../../parsing';
import { PromVisualQuery } from '../../../types';
import { Interaction, QuerySuggestion, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';

// actions to update the state
const { updateInteraction } = stateSlice.actions;

export const querySuggestions: QuerySuggestion[] = [
  {
    query: 'min(up{instance="localhost:3005"})',
    explanation: '',
  },
  {
    query: 'sum(access_evaluation_duration_sum{instance="localhost:3005"})',
    explanation: '',
  },
  {
    query: 'avg(go_goroutines{job="go-app"})',
    explanation: '',
  },
  {
    query:
      'histogram_quantile(0.95, sum by(le) (rate(access_evaluation_duration_bucket{job="go-app"}[$__rate_interval])))',
    explanation: '',
  },
  {
    query: 'go_gc_duration_seconds{instance="localhost:3005"}',
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
  // HISTORICAL RESPONSE
  const check = await promQailHealthcheck();
  if (!check || !interaction || interaction.suggestionType === SuggestionType.Historical) {
    new Promise<void>((resolve) => {
      return setTimeout(() => {
        const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

        const suggestions =
          interactionToUpdate.suggestionType === SuggestionType.Historical ? querySuggestions : [querySuggestions[0]];

        const payload = {
          idx,
          interaction: { ...interactionToUpdate, suggestions: suggestions, isLoading: false },
        };
        dispatch(updateInteraction(payload));
        resolve();
      }, 1000);
    });
  } else {
    let url = 'http://localhost:5001/query-suggest';

    type SuggestionBody = {
      metric: string;
      labels: string;
      prompt?: string;
    };

    let feedTheAI: SuggestionBody = {
      metric: query.metric,
      labels: promQueryModeller.renderLabels(query.labels),
    };

    if (interaction.prompt) {
      feedTheAI = { ...feedTheAI, prompt: interaction.prompt };
    }

    const body = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedTheAI),
    };

    const promQailPromise = fetch(url, body);

    const promQailResp = await promQailPromise
      .then((resp) => {
        return resp.json();
      })
      .catch((error) => {
        return { error: error };
      });

    const interactionToUpdate = interaction;

    const suggestions = [
      {
        query: promQailResp[0],
        explanation: '',
      },
    ];

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
}

async function promQailHealthcheck() {
  const resp = await fetch('http://localhost:5001')
    .then((resp) => resp.text())
    .then((data) => data)
    .catch((error) => error);

  return resp === 'success';
}
