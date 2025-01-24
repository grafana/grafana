// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/promQail/state/helpers.ts
import { AnyAction } from 'redux';

import { openai, vector } from '@grafana/llm';
import { reportInteraction } from '@grafana/runtime';

import { PrometheusDatasource } from '../../../../datasource';
import { getMetadataHelp, getMetadataType } from '../../../../language_provider';
import { promQueryModeller } from '../../../PromQueryModeller';
import { buildVisualQueryFromString } from '../../../parsing';
import { PromVisualQuery } from '../../../types';
import { updateInteraction } from '../PromQail';
import {
  ExplainSystemPrompt,
  GetExplainUserPrompt,
  SuggestSystemPrompt,
  GetSuggestUserPrompt,
  SuggestUserPromptParams,
} from '../prompts';
import { Interaction, QuerySuggestion, SuggestionType } from '../types';

import { createInteraction } from './state';
import { getTemplateSuggestions } from './templates';

const OPENAI_MODEL_NAME = 'gpt-3.5-turbo-1106';
const promQLTemplatesCollection = 'grafana.promql.templates';

interface TemplateSearchResult {
  description: string | null;
  metric_type: string | null;
  promql: string | null;
}

export function getExplainMessage(query: string, metric: string, datasource: PrometheusDatasource): openai.Message[] {
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

function getSuggestMessages({
  promql,
  question,
  metricType,
  labels,
  templates,
}: SuggestUserPromptParams): openai.Message[] {
  return [
    { role: 'system', content: SuggestSystemPrompt },
    { role: 'user', content: GetSuggestUserPrompt({ promql, question, metricType, labels, templates }) },
  ];
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
  const suggestedQuery = interaction.suggestions[suggIdx].query;

  const promptMessages = getExplainMessage(suggestedQuery, query.metric, datasource);
  const interactionToUpdate = interaction;

  return openai
    .streamChatCompletions({
      model: OPENAI_MODEL_NAME,
      messages: promptMessages,
      temperature: 0,
    })
    .pipe(openai.accumulateContent())
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
 * Check if sublist is fully contained in the superlist
 *
 * @param sublist
 * @param superlist
 * @returns true if fully contained, else false
 */
function isContainedIn(sublist: string[], superlist: string[]): boolean {
  for (const item of sublist) {
    if (!superlist.includes(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Guess the type of a metric, based on its name and its relation to other metrics available
 *
 * @param metric     - name of metric whose type to guess
 * @param allMetrics - list of all available metrics
 * @returns          - the guess of the type (string): counter,gauge,summary,histogram,'histogram,summary'
 */
export function guessMetricType(metric: string, allMetrics: string[]): string {
  const synthetic_metrics = new Set<string>([
    'up',
    'scrape_duration_seconds',
    'scrape_samples_post_metric_relabeling',
    'scrape_series_added',
    'scrape_samples_scraped',
    'ALERTS',
    'ALERTS_FOR_STATE',
  ]);

  if (synthetic_metrics.has(metric)) {
    // these are all known to be counters
    return 'counter';
  }
  if (metric.startsWith(':')) {
    // probably recording rule
    return 'gauge';
  }
  if (metric.endsWith('_info')) {
    // typically series of 1s only, the labels are the useful part. TODO: add 'info' type
    return 'counter';
  }

  if (metric.endsWith('_created') || metric.endsWith('_total')) {
    // prometheus naming style recommends counters to have these suffixes.
    return 'counter';
  }

  const underscoreIndex = metric.lastIndexOf('_');
  if (underscoreIndex < 0) {
    // No underscores in the name at all, very little info to go on. Guess
    return 'gauge';
  }

  // See if the suffix is histogram-y or summary-y
  const [root, suffix] = [metric.slice(0, underscoreIndex), metric.slice(underscoreIndex + 1)];

  if (['bucket', 'count', 'sum'].includes(suffix)) {
    // Might be histogram + summary
    let familyMetrics = [`${root}_bucket`, `${root}_count`, `${root}_sum`, root];
    if (isContainedIn(familyMetrics, allMetrics)) {
      return 'histogram,summary';
    }

    // Might be a histogram, if so all these metrics should exist too:
    familyMetrics = [`${root}_bucket`, `${root}_count`, `${root}_sum`];
    if (isContainedIn(familyMetrics, allMetrics)) {
      return 'histogram';
    }

    // Or might be a summary
    familyMetrics = [`${root}_sum`, `${root}_count`, root];
    if (isContainedIn(familyMetrics, allMetrics)) {
      return 'summary';
    }

    // Otherwise it's probably just a counter!
    return 'counter';
  }

  // One case above doesn't catch: summary or histogram,summary where the non-suffixed metric is chosen
  const familyMetrics = [`${metric}_sum`, `${metric}_count`, metric];
  if (isContainedIn(familyMetrics, allMetrics)) {
    if (allMetrics.includes(`${metric}_bucket`)) {
      return 'histogram,summary';
    } else {
      return 'summary';
    }
  }

  // All else fails, guess gauge
  return 'gauge';
}

/**
 * Generate a suitable filter structure for the VectorDB call
 * @param types: list of metric types to include in the result
 * @returns the structure to pass to the vectorDB call.
 */
function generateMetricTypeFilters(types: string[]) {
  return types.map((type) => ({
    metric_type: {
      $eq: type,
    },
  }));
}

/**
 * Taking in a metric name, try to guess its corresponding metric _family_ name
 * @param metric name
 * @returns metric family name
 */
function guessMetricFamily(metric: string): string {
  if (metric.endsWith('_bucket') || metric.endsWith('_count') || metric.endsWith('_sum')) {
    return metric.slice(0, metric.lastIndexOf('_'));
  }
  return metric;
}

/**
 * Check if the LLM plugin is enabled.
 * Used in the PromQueryBuilder to enable/disable the button based on openai and vector db checks
 * @returns true if the LLM plugin is enabled.
 */
export async function isLLMPluginEnabled(): Promise<boolean> {
  // Check if the LLM plugin is enabled.
  // If not, we won't be able to make requests, so return early.
  const openaiEnabled = openai.health().then((response) => response.ok);
  const vectorEnabled = vector.health().then((response) => response.ok);
  // combine 2 promises
  return Promise.all([openaiEnabled, vectorEnabled]).then((results) => {
    return results.every((result) => result);
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
  const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

  // Decide metric type
  let metricType = '';
  // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the
  // provider but we only need the metadata here.
  if (!datasource.languageProvider.metricsMetadata) {
    await datasource.languageProvider.loadMetricsMetadata();
  }
  if (datasource.languageProvider.metricsMetadata) {
    // `datasource.languageProvider.metricsMetadata` is a list of metric family names (with desired type)
    // from the datasource metadata endoint, but unfortunately the expanded _sum, _count, _bucket raw
    // metric names are also generated and populating this list (all of type counter). We want the metric
    // family type, so need to guess the metric family name from the chosen metric name, and test if that
    // metric family has a type specified.
    const metricFamilyGuess = guessMetricFamily(query.metric);
    metricType = getMetadataType(metricFamilyGuess, datasource.languageProvider.metricsMetadata) ?? '';
  }
  if (metricType === '') {
    // fallback to heuristic guess
    metricType = guessMetricType(query.metric, datasource.languageProvider.metrics);
  }

  if (interactionToUpdate.suggestionType === SuggestionType.Historical) {
    return new Promise<void>((resolve) => {
      return setTimeout(() => {
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

    // get all available labels
    const metricLabels = await datasource.languageProvider.fetchLabelsWithMatch(query.metric);

    let feedTheAI: SuggestionBody = {
      metric: query.metric,
      // drop __name__ label because it's not useful
      labels: Object.keys(metricLabels)
        .filter((label) => label !== '__name__')
        .join(','),
    };

    // @ts-ignore llms types issue
    let results: Array<llms.vector.SearchResult<TemplateSearchResult>> = [];
    if (interaction?.suggestionType === SuggestionType.AI) {
      feedTheAI = { ...feedTheAI, prompt: interaction.prompt };

      // @ts-ignore llms types issue
      results = await llms.vector.search<TemplateSearchResult>({
        query: interaction.prompt,
        collection: promQLTemplatesCollection,
        topK: 5,
        filter: {
          $or: generateMetricTypeFilters(metricType.split(',').concat(['*'])),
        },
      });
      reportInteraction('grafana_prometheus_promqail_vector_results', {
        metric: query.metric,
        prompt: interaction.prompt,
        results: results,
      });
      // TODO: handle errors from vector search
    }

    const resultsString = results
      .map((r) => {
        return `${r.payload.promql} | ${r.payload.description} (score=${(r.score * 100).toFixed(1)})`;
      })
      .join('\n');

    const promptMessages = getSuggestMessages({
      promql: query.metric,
      question: interaction ? interaction.prompt : '',
      metricType: metricType,
      labels: labelNames.join(', '),
      templates: resultsString,
    });

    return openai
      .streamChatCompletions({
        model: OPENAI_MODEL_NAME,
        messages: promptMessages,
        temperature: 0.5,
      })
      .pipe(openai.accumulateContent())
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
