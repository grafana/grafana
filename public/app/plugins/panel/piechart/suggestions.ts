import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { PieChartLabels, PieChartOptions, PieChartType } from './types';

export function getSuggestions(builder: VisualizationSuggestionsBuilder) {
  if (!builder.dataExists) {
    return;
  }

  const list = builder.getListAppender<PieChartOptions, {}>({
    name: 'Piechart',
    pluginId: 'piechart',
    options: {
      reduceOptions: {
        values: true,
        calcs: [],
      },
      displayLabels: [PieChartLabels.Percent],
      legend: {
        placement: 'right',
        values: [],
      } as any,
    },
    previewModifier: (s) => {
      // Hide labels in preview
      s.options!.legend.displayMode = LegendDisplayMode.Hidden;
      s.options!.displayLabels = [];
    },
  });

  if (builder.dataFrameCount === 1) {
    // if many values this is not a good option
    if (builder.dataRowCount > 10) {
      return;
    }

    list.append({});
    list.append({
      name: 'Piechart donut',
      options: {
        pieType: PieChartType.Donut,
      },
    });

    return;
  }

  if (builder.dataFrameCount > 30) {
    return;
  }

  list.append({
    options: {
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
      },
    },
  });
}
