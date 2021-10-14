import { FieldType, VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode } from '@grafana/schema';
import { TimeSeriesOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return null;
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<TimeSeriesOptions, GraphFieldConfig>({
    name: 'Line graph',
    pluginId: 'timeseries',
    options: {
      legend: {} as any,
    },
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      s.options!.legend.displayMode = LegendDisplayMode.Hidden;
    },
  });

  for (const frame of frames) {
    const hasTimeField = frame.fields.some((x) => x.type === FieldType.time);
    const hasNumberField = frame.fields.some((x) => x.type === FieldType.number);

    if (!hasTimeField || !hasNumberField) {
      return null;
    }
  }

  builder.add({});

  return builder.getList();
}
