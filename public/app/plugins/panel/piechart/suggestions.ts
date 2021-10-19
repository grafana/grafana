import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { PieChartLabels, PieChartOptions, PieChartType } from './types';

export class PieChartSuggestionsSupplier {
  getDataSuggestions(builder: VisualizationSuggestionsBuilder) {
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

    const { dataSummary } = builder;

    if (dataSummary.frameCount === 1) {
      // if many values this is not a good option
      if (dataSummary.rowCountTotal > 10) {
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

    if (dataSummary.frameCount > 30) {
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
}
