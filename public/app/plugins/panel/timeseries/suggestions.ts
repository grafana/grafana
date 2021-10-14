import { VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/schema';
import { TimeSeriesOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<TimeSeriesOptions, GraphFieldConfig>({
    name: 'Bar chart',
    pluginId: 'barchart',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      if (s.options!.values) {
        s.options!.values.limit = 2;
      }
    },
  });

  if (frames.length === 1) {
    builder.add({});
  }

  return builder.getList();
}
