import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, StackingMode, VisibilityMode } from '@grafana/schema';

import { FieldConfig, Options } from './panelcfg.gen';

export class BarChartSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, FieldConfig>({
      name: t('barchart.suggestions.name', 'Bar chart'),
      pluginId: 'barchart',
      options: {
        showValue: VisibilityMode.Never,
        legend: {
          calcs: [],
          displayMode: LegendDisplayMode.List,
          showLegend: true,
          placement: 'right',
        },
      },
      fieldConfig: {
        defaults: {
          unit: 'short',
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.options!.barWidth = 0.8;
        },
      },
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = this.getListWithDefaults(builder);
    const { dataSummary } = builder;

    if (dataSummary.frameCount !== 1) {
      return;
    }

    if (!dataSummary.hasNumberField || !dataSummary.hasStringField) {
      return;
    }

    // if you have this many rows barchart might not be a good fit
    if (dataSummary.rowCountTotal > 50) {
      return;
    }

    // Vertical bars
    list.append({});

    if (dataSummary.numberFieldCount > 1) {
      list.append({
        name: t('barchart.suggestions.bar-stacked', 'Bar chart (stacked)'),
        options: {
          stacking: StackingMode.Normal,
        },
      });
      list.append({
        name: t('barchart.suggestions.bar-stacked-percent', 'Bar chart (100%, stacked)'),
        options: {
          stacking: StackingMode.Percent,
        },
      });
    }

    // horizontal bars
    list.append({
      name: t('barchart.suggestions.bar-horizontal', 'Bar chart (horizontal)'),
      options: {
        orientation: VizOrientation.Horizontal,
      },
    });

    if (dataSummary.numberFieldCount > 1) {
      list.append({
        name: t('barchart.suggestions.bar-horizontal-stacked', 'Bar chart (horizontal, stacked)'),
        options: {
          stacking: StackingMode.Normal,
          orientation: VizOrientation.Horizontal,
        },
      });

      list.append({
        name: t('barchart.suggestions.bar-horizontal-stacked-percent', 'Bar chart (100%, horizontal, stacked)'),
        options: {
          orientation: VizOrientation.Horizontal,
          stacking: StackingMode.Percent,
        },
      });
    }
  }
}
