import { AnyAction } from 'redux';

import { llms } from '@grafana/experimental';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getMetadataHelp, getMetadataType } from 'app/plugins/datasource/prometheus/language_provider';

import { promQueryModeller } from '../../../PromQueryModeller';
import { buildVisualQueryFromString } from '../../../parsing';
import { PromVisualQuery } from '../../../types';
import {
  ExplainSystemPrompt,
  GetExplainUserPrompt,
  GetSuggestSystemPrompt,
  SuggestSystemPromptParams,
} from '../prompts';
import { Interaction, QuerySuggestion, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';
import { getTemplateSuggestions } from './templates';

const OPENAI_MODEL_NAME = 'gpt-3.5-turbo';
const promQLTemplatesCollection = 'grafana.promql.templates';
// actions to update the state
const { updateInteraction } = stateSlice.actions;

interface TemplateSearchResult {
  description: string | null;
  metric_type: string | null;
  promql: string | null;
}

export function getExplainMessage(
  query: string,
  metric: string,
  datasource: PrometheusDatasource
): llms.openai.Message[] {
  let metricMetadata = '';
  let metricType = '';

  const pvq = buildVisualQueryFromString(query);

  if (datasource.languageProvider.metricsMetadata) {
    metricType = getMetadataType(metric, datasource.languageProvider.metricsMetadata) ?? '';
    metricMetadata = getMetadataHelp(metric, datasource.languageProvider.metricsMetadata) ?? '';
  }

  const documentationBody = pvq.query.operations
    .map((op) => {
      const def = promQueryModeller.getOperationDef(op.id);
      if (!def) {
        return '';
      }
      const title = def.renderer(op, def, '<expr>');
      const body = def.explainHandler ? def.explainHandler(op, def) : def.documentation;

      if (!body) {
        return '';
      }
      return `### ${title}:\n${body}`;
    })
    .filter((item) => item !== '')
    .join('\n');

  return [
    { role: 'system', content: ExplainSystemPrompt },
    {
      role: 'user',
      content: GetExplainUserPrompt({
        documentation: documentationBody,
        metricName: metric,
        metricType: metricType,
        metricMetadata: metricMetadata,
        query: query,
      }),
    },
  ];
}

function getSuggestMessage({ promql, question, labels, templates }: SuggestSystemPromptParams): llms.openai.Message[] {
  return [{ role: 'system', content: GetSuggestSystemPrompt({ promql, question, labels, templates }) }];
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

  const promptMessages = getExplainMessage(suggestedQuery, query.metric, datasource);
  const interactionToUpdate = interaction;

  return llms.openai
    .streamChatCompletions({
      model: OPENAI_MODEL_NAME,
      messages: promptMessages,
    })
    .pipe(llms.openai.accumulateContent())
    .subscribe((response) => {
      const updatedSuggestions = interactionToUpdate.suggestions.map((sg: QuerySuggestion, sidx: number) => {
        if (suggIdx === sidx) {
          return {
            query: interactionToUpdate.suggestions[suggIdx].query,
            explanation: response,
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
    });
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
  labelNames: string[],
  datasource: PrometheusDatasource,
  interaction?: Interaction
) {
  // when you're not running promqail
  // @ts-ignore llms types issue
  const check = (await llms.openai.enabled()) && (await llms.vector.enabled());

  const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

  if (!check || interactionToUpdate.suggestionType === SuggestionType.Historical) {
    return new Promise<void>((resolve) => {
      return setTimeout(() => {
        let metricType = getMetadataType(query.metric, datasource.languageProvider.metricsMetadata!) ?? '';
        const suggestions = getTemplateSuggestions(
          query.metric,
          metricType,
          promQueryModeller.renderLabels(query.labels)
        );

        const payload = {
          idx,
          interaction: { ...interactionToUpdate, suggestions: suggestions, isLoading: false },
        };
        dispatch(updateInteraction(payload));
        resolve();
      }, 1000);
    });
  } else {
    type SuggestionBody = {
      metric: string;
      labels: string;
      prompt?: string;
    };

    let feedTheAI: SuggestionBody = {
      metric: query.metric,
      labels: promQueryModeller.renderLabels(query.labels),
    };

    // @ts-ignore llms types issue
    let results: Array<llms.vector.SearchResult<TemplateSearchResult>> = [];
    if (interaction?.suggestionType === SuggestionType.AI) {
      feedTheAI = { ...feedTheAI, prompt: interaction.prompt };

      // TODO: filter by metric type
      // @ts-ignore llms types issue
      results = await llms.vector.search<TemplateSearchResult>({
        query: interaction.prompt,
        collection: promQLTemplatesCollection,
        topK: 5,
      });
      // TODO: handle errors from vector search
    }

    const resultsString = results
      .map((r) => {
        return `PromQL: ${r.payload.promql}\nDescription: ${r.payload.description}`;
      })
      .join('\n');

    const promptMessages = getSuggestMessage({
      promql: query.metric,
      question: interaction ? interaction.prompt : '',
      labels: labelNames.join(', '),
      templates: resultsString,
    });

    return llms.openai
      .streamChatCompletions({
        model: OPENAI_MODEL_NAME,
        messages: promptMessages,
      })
      .pipe(llms.openai.accumulateContent())
      .subscribe((response) => {
        const payload = {
          idx,
          interaction: {
            ...interactionToUpdate,
            suggestions: [
              {
                query: response,
                explanation: '',
              },
            ],
            isLoading: false,
          },
        };
        dispatch(updateInteraction(payload));
      });
  }
}
