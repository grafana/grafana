import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
import { PieChartLabels, PieChartOptions, PieChartType } from './types';

export class PieChartSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<PieChartOptions, {}>({
      name: SuggestionName.PieChart,
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

    if (!dataSummary.hasNumberField) {
      return;
    }

    if (dataSummary.frameCount === 1) {
      // if many values this or single value PieChart is not a good option
      if (dataSummary.rowCountTotal > 30 || dataSummary.rowCountTotal < 2) {
        return;
      }

      list.append({});
      list.append({
        name: SuggestionName.PieChartDonut,
        options: {
          pieType: PieChartType.Donut,
        },
      });

      return;
    }

    if (dataSummary.numberFieldCount > 30 || dataSummary.numberFieldCount < 2) {
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

    list.append({
      name: SuggestionName.PieChartDonut,
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
        pieType: PieChartType.Donut,
      },
    });
  }
}
