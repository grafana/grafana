import { AnyAction } from 'redux';

import { llms } from '@grafana/experimental';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';

import { PromVisualQuery } from '../../../types';
import { GetComponentSuggestionsUserPrompt, GetComponentSuggestionsSystemPrompt } from '../prompts';
import { Interaction, Suggestion, SuggestionType } from '../types';

import { createInteraction, stateSlice } from './state';
import { getTemplateSuggestions } from './templates';

const OPENAI_MODEL_NAME = 'gpt-3.5-turbo';

// actions to update the state
const { updateInteraction } = stateSlice.actions;

export function getExplainMessage(templates?: Suggestion[], question?: string): llms.openai.Message[] {
  // Look at the templates and the promtps to make the AI return helpful things
  return [
    {
      role: 'system',
      content: GetComponentSuggestionsSystemPrompt({ templates }),
    },
    {
      role: 'user',
      content: GetComponentSuggestionsUserPrompt({ question: question, templates }),
    },
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
  const suggestedQuery = interaction.suggestions[suggIdx].component;

  const promptMessages = getExplainMessage(templates, interaction.prompt);
  const interactionToUpdate = interaction;

  return llms.openai
    .streamChatCompletions({
      model: OPENAI_MODEL_NAME,
      messages: promptMessages,
      temperature: 0,
    })
    .pipe(llms.openai.accumulateContent())
    .subscribe((response) => {
      const updatedSuggestions = interactionToUpdate.suggestions.map((sg: Suggestion, sidx: number) => {
        if (suggIdx === sidx) {
          return {
            component: interactionToUpdate.suggestions[suggIdx].component,
            explanation: response,
            testid: '',
            order: 0,
            link: '',
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
// function isContainedIn(sublist: string[], superlist: string[]): boolean {
//   for (const item of sublist) {
//     if (!superlist.includes(item)) {
//       return false;
//     }
//   }
//   return true;
// }

// /**
//  * Guess the type of a metric, based on its name and its relation to other metrics available
//  *
//  * @param metric     - name of metric whose type to guess
//  * @param allMetrics - list of all available metrics
//  * @returns          - the guess of the type (string): counter,gauge,summary,histogram,'histogram,summary'
//  */
// export function guessMetricType(metric: string, allMetrics: string[]): string {
//   const synthetic_metrics = new Set<string>([
//     'up',
//     'scrape_duration_seconds',
//     'scrape_samples_post_metric_relabeling',
//     'scrape_series_added',
//     'scrape_samples_scraped',
//     'ALERTS',
//     'ALERTS_FOR_STATE',
//   ]);

//   if (synthetic_metrics.has(metric)) {
//     // these are all known to be counters
//     return 'counter';
//   }
//   if (metric.startsWith(':')) {
//     // probably recording rule
//     return 'gauge';
//   }
//   if (metric.endsWith('_info')) {
//     // typically series of 1s only, the labels are the useful part. TODO: add 'info' type
//     return 'counter';
//   }

//   if (metric.endsWith('_created') || metric.endsWith('_total')) {
//     // prometheus naming style recommends counters to have these suffixes.
//     return 'counter';
//   }

//   const underscoreIndex = metric.lastIndexOf('_');
//   if (underscoreIndex < 0) {
//     // No underscores in the name at all, very little info to go on. Guess
//     return 'gauge';
//   }

//   // See if the suffix is histogram-y or summary-y
//   const [root, suffix] = [metric.slice(0, underscoreIndex), metric.slice(underscoreIndex + 1)];

//   if (['bucket', 'count', 'sum'].includes(suffix)) {
//     // Might be histogram + summary
//     let familyMetrics = [`${root}_bucket`, `${root}_count`, `${root}_sum`, root];
//     if (isContainedIn(familyMetrics, allMetrics)) {
//       return 'histogram,summary';
//     }

//     // Might be a histogram, if so all these metrics should exist too:
//     familyMetrics = [`${root}_bucket`, `${root}_count`, `${root}_sum`];
//     if (isContainedIn(familyMetrics, allMetrics)) {
//       return 'histogram';
//     }

//     // Or might be a summary
//     familyMetrics = [`${root}_sum`, `${root}_count`, root];
//     if (isContainedIn(familyMetrics, allMetrics)) {
//       return 'summary';
//     }

//     // Otherwise it's probably just a counter!
//     return 'counter';
//   }

//   // One case above doesn't catch: summary or histogram,summary where the non-suffixed metric is chosen
//   const familyMetrics = [`${metric}_sum`, `${metric}_count`, metric];
//   if (isContainedIn(familyMetrics, allMetrics)) {
//     if (allMetrics.includes(`${metric}_bucket`)) {
//       return 'histogram,summary';
//     } else {
//       return 'summary';
//     }
//   }

//   // All else fails, guess gauge
//   return 'gauge';
// }

/**
 * Generate a suitable filter structure for the VectorDB call
 * @param types: list of metric types to include in the result
 * @returns the structure to pass to the vectorDB call.
 */
// function generateMetricTypeFilters(types: string[]) {
//   return types.map((type) => ({
//     metric_type: {
//       $eq: type,
//     },
//   }));
// }

/**
 * Taking in a metric name, try to guess its corresponding metric _family_ name
 * @param metric name
 * @returns metric family name
 */
// function guessMetricFamily(metric: string): string {
//   if (metric.endsWith('_bucket') || metric.endsWith('_count') || metric.endsWith('_sum')) {
//     return metric.slice(0, metric.lastIndexOf('_'));
//   }
//   return metric;
// }

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
  templates: Suggestion[],
  interaction?: Interaction
) {
  // when you're not running promqail
  // @ts-ignore llms types issue
  const check = await llms.openai.enabled(); // && (await llms.vector.enabled());

  const interactionToUpdate = interaction ? interaction : createInteraction(SuggestionType.Historical);

  if (!check || interactionToUpdate.suggestionType === SuggestionType.Historical) {
    return new Promise<void>((resolve) => {
      const suggestions = getTemplateSuggestions();

      const payload = {
        idx,
        interaction: { ...interactionToUpdate, suggestions: suggestions, isLoading: false },
      };
      dispatch(updateInteraction(payload));
      resolve();
    });
  } else {
    // GET SUGGESTIONS FOR COMPONENTS
    const promptMessages = getExplainMessage(templates, interaction?.prompt);

    const info = await llms.openai.chatCompletions({
      model: OPENAI_MODEL_NAME,
      messages: promptMessages,
      temperature: 0,
    });

    const componentsArray = JSON.parse(info.choices[0].message.content);

    const payload = {
      idx,
      interaction: {
        ...interactionToUpdate,
        suggestions: componentsArray,
        isLoading: false,
      },
    };

    dispatch(updateInteraction(payload));
  }
}
