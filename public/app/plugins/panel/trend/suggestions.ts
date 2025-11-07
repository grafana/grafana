import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphDrawStyle, GraphFieldConfig, LegendDisplayMode } from '@grafana/schema';

import { Options } from './panelcfg.gen';
import { validateSeries } from './utils';

export class TrendSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options, GraphFieldConfig> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, GraphFieldConfig>({
      name: t('trend.suggestions.name', 'Trend chart'),
      pluginId: 'trend',
      options: {
        legend: {
          calcs: [],
          displayMode: LegendDisplayMode.Hidden,
          placement: 'right',
          showLegend: false,
        },
      },
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
            s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
          }
        },
      },
    });
  }
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (dataSummary.numberFieldCount < 2 || dataSummary.rowCountTotal < 2 || dataSummary.hasTimeField) {
      return;
    }

    if (validateSeries(builder.data?.series ?? []).warning) {
      return;
    }

    this.getListAppender(builder).append({});
  }
}
