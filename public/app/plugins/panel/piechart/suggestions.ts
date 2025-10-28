import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode } from '@grafana/schema';

import { PieChartLabels, Options, PieChartType } from './panelcfg.gen';

export class PieChartSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, {}>({
      name: t('piechart.suggestions.name', 'Pie chart'),
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
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = this.getListWithDefaults(builder);

    const { dataSummary } = builder;

    if (!dataSummary.hasNumberField) {
      return;
    }

    // if many values this or single value PieChart is not a good option
    if (dataSummary.numberFieldCount > 30 || (!dataSummary.hasStringField && dataSummary.numberFieldCount < 2)) {
      return;
    }

    let optionsOverrides = {};

    if (dataSummary.hasStringField && dataSummary.frameCount === 1) {
      optionsOverrides = {
        reduceOptions: {
          values: true,
          calcs: [],
        },
      };
    }

    list.append({ options: optionsOverrides });
    list.append({
      name: t('piechart.suggestions.donut', 'Pie chart (donut)'),
      options: {
        ...optionsOverrides,
        pieType: PieChartType.Donut,
      },
    });
  }
}
