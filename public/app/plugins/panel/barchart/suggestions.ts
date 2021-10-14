import {
  FieldType,
  VisualizationSuggestionBuilderUtil,
  VisualizationSuggestionsInput,
  VizOrientation,
} from '@grafana/data';
import { LegendDisplayMode, VisibilityMode } from '@grafana/schema';
import { BarChartFieldConfig, BarChartOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return null;
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<BarChartOptions, BarChartFieldConfig>({
    name: 'Bar chart',
    pluginId: 'barchart',
    options: {
      showValue: VisibilityMode.Never,
      legend: {
        displayMode: LegendDisplayMode.Hidden,
        placement: 'right',
      } as any,
    },
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
  });

  if (frames.length !== 1) {
    return null;
  }

  const hasStringField = frames[0].fields.some((x) => x.type === FieldType.string);
  if (!hasStringField) {
    return null;
  }

  builder.add({});
  builder.add({
    name: 'Bar chart horizontal',
    options: {
      orientation: VizOrientation.Horizontal,
    },
  });

  return builder.getList();
}
