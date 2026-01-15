import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';

import { Options, defaultOptions } from './panelcfg.gen';

export const instantQueryResultsSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (ds) => {
  if (!ds.hasData) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [];

  // Suggest for instant query results: single frame, no time field, has string and number fields
  // This is typical of Prometheus instant queries that return label/value pairs
  if (
    ds.frameCount === 1 &&
    !ds.hasFieldType(FieldType.time) &&
    ds.hasFieldType(FieldType.string) &&
    ds.hasFieldType(FieldType.number)
  ) {
    suggestions.push({
      name: 'Instant Query Results',
      options: {
        ...defaultOptions,
        displayMode: 'table',
        showToggle: true,
      },
    });
  }

  return suggestions;
};
