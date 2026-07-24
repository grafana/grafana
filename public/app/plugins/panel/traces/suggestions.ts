import { defaultsDeep } from 'lodash';

import { type VisualizationSuggestion, type VisualizationSuggestionsSupplier } from '@grafana/data';

import { type TracesPanelOptions } from './TracesPanel';

const withDefaults = (
  suggestion: VisualizationSuggestion<TracesPanelOptions>
): VisualizationSuggestion<TracesPanelOptions> =>
  defaultsDeep(suggestion, {
    cardOptions: {
      previewModifier: (s) => {
        s.options = s.options ?? {};
        s.options.hideHeaderDetails = true;
      },
    },
  } satisfies VisualizationSuggestion<TracesPanelOptions>);

export const tracesSuggestionsSupplier: VisualizationSuggestionsSupplier<TracesPanelOptions> = (dataSummary) => {
  if (!dataSummary.hasPreferredVisualisationType('trace')) {
    return;
  }

  return [withDefaults({})];
};
