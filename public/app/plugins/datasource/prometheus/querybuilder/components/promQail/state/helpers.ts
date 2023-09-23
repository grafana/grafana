import { AnyAction } from 'redux';

import { llms } from '@grafana/experimental';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp } from 'app/plugins/datasource/prometheus/language_provider';

import { promQueryModeller } from '../../../PromQueryModeller';
import { buildVisualQueryFromString } from '../../../parsing';
import { PromVisualQuery } from '../../../types';
import { ExplainSystemPrompt, GetExplainUserPrompt } from '../prompts';
import { Interaction, QuerySuggestion, SuggestionType } from '../types';

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


async function OpenAIChatCompletions(messages: llms.openai.Message[]): Promise<string> {
  const response = await llms.openai.chatCompletions({
    model: "gpt-3.5-turbo",
    messages: messages
  });

  return response.choices[0].message.content
}

function getExplainMessage(documentation: string, metricType: string, description: string, query: string): llms.openai.Message[] {
  
  return [
    { role: 'system', content: ExplainSystemPrompt},
    { role: 'user', content: GetExplainUserPrompt(documentation, metricType, description, query) },
  ]
}



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
  // const enabled = await llms.openai.enabled();

  // if (!enabled) {
  //   return false;
  // }

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

  const promptMessages = getExplainMessage(
    '',
    query.metric,
    metricMetadata ?? '',
    suggestedQuery
  );

  const explainerResponse = await OpenAIChatCompletions(promptMessages);


  const interactionToUpdate = interaction;
  // switch to returning 1 query until we get more confidence returning more
  const explanation = explainerResponse;

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
  // when you're not running promqail
  const check = await promQailHealthcheck();
  if (!check) {
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

    if (interaction?.suggestionType === SuggestionType.AI) {
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

    const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

    const suggestions: QuerySuggestion[] = promQailResp.map((resp: string) => {
      return {
        query: resp,
        explanation: '',
      };
    });

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
