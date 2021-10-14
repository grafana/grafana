import { FieldType, VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode, StackingMode } from '@grafana/schema';
import { TimeSeriesOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return null;
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<TimeSeriesOptions, GraphFieldConfig>({
    name: 'Line chart',
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
  builder.add({
    name: 'Area chart stacked',
    fieldConfig: {
      defaults: {
        custom: {
          fillOpacity: 15,
          stacking: {
            mode: StackingMode.Normal,
            group: 'A',
          },
        },
      },
      overrides: [],
    },
  });

  return builder.getList();
}
