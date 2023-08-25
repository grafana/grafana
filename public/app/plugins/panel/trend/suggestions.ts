import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig, VizLegendOptions } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class TrendSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (dataSummary.numberFieldCount < 2 || dataSummary.rowCountTotal < 2 || dataSummary.rowCountTotal < 2) {
      return;
    }

    // Super basic
    const list = builder.getListAppender<Options, GraphFieldConfig>({
      name: SuggestionName.LineChart,
      pluginId: 'trend',
      options: {
        legend: {} as VizLegendOptions,
      },
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.options!.legend.showLegend = false;

          if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
            s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
          }
        },
      },
    });
    return list;
  }
}
