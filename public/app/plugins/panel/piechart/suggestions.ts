import { VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { PieChartOptions, PieChartType } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<PieChartOptions, {}>({
    name: 'Piechart',
    pluginId: 'piechart',
    options: {
      reduceOptions: {
        values: true,
        calcs: [],
      },
      legend: {
        displayMode: LegendDisplayMode.Hidden,
        placement: 'right',
      } as any,
    },
  });

  if (frames.length === 1) {
    builder.add({});
    builder.add({
      name: 'Piechart donut',
      options: {
        pieType: PieChartType.Donut,
      },
    });
  }

  if (frames.length > 1 && frames.length < 30) {
    builder.add({
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
    });
  }

  return builder.getList();
}
