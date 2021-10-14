import { FieldType, VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { GaugeOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<GaugeOptions, {}>({
    name: 'Gauge',
    pluginId: 'gauge',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      if (s.options!.reduceOptions.values) {
        s.options!.reduceOptions.limit = 2;
      }
    },
  });

  if (frames.length === 1) {
    if (
      frames[0].fields.some((x) => x.type === FieldType.string) &&
      frames[0].fields.some((x) => x.type === FieldType.number)
    ) {
      builder.add({
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });
    }
  }

  return builder.getList();
}
