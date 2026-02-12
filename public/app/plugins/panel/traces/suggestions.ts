import { defaultsDeep } from 'lodash';

import { VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';

import { TracesPanelOptions } from './TracesPanel';

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
