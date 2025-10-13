import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';

import { PieChartLabels, Options, PieChartType } from './panelcfg.gen';

export class PieChartSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<Options, {}>({
      name: SuggestionName.PieChart,
      pluginId: 'piechart',
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
        displayLabels: [PieChartLabels.Percent],
        legend: {
          calcs: [],
          displayMode: LegendDisplayMode.Hidden,
          placement: 'right',
          values: [],
          showLegend: false,
        },
      },
    });

    const { dataSummary } = builder;

    if (!dataSummary.hasNumberField) {
      return;
    }

    if (dataSummary.hasStringField && dataSummary.frameCount === 1) {
      // if many values this or single value PieChart is not a good option
      if (dataSummary.rowCountTotal > 30 || dataSummary.rowCountTotal < 2) {
        return;
      }

      list.append({
        name: SuggestionName.PieChart,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });

      list.append({
        name: SuggestionName.PieChartDonut,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
          pieType: PieChartType.Donut,
        },
      });

      return;
    }

    if (dataSummary.numberFieldCount > 30 || dataSummary.numberFieldCount < 2) {
      return;
    }

    list.append({
      name: SuggestionName.PieChart,
    });

    list.append({
      name: SuggestionName.PieChartDonut,
      options: {
        pieType: PieChartType.Donut,
      },
    });
  }
}
