import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { LegendDisplayMode, StackingMode, VisibilityMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';

import { PanelFieldConfig, PanelOptions } from './panelcfg.gen';

export class BarChartSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<PanelOptions, PanelFieldConfig>({
      name: SuggestionName.BarChart,
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
    list.append({
      name: SuggestionName.BarChart,
    });

    if (dataSummary.numberFieldCount > 1) {
      list.append({
        name: SuggestionName.BarChartStacked,
        options: {
          stacking: StackingMode.Normal,
        },
      });
      list.append({
        name: SuggestionName.BarChartStackedPercent,
        options: {
          stacking: StackingMode.Percent,
        },
      });
    }

    // horizontal bars
    list.append({
      name: SuggestionName.BarChartHorizontal,
      options: {
        orientation: VizOrientation.Horizontal,
      },
    });

    if (dataSummary.numberFieldCount > 1) {
      list.append({
        name: SuggestionName.BarChartHorizontalStacked,
        options: {
          stacking: StackingMode.Normal,
          orientation: VizOrientation.Horizontal,
        },
      });

      list.append({
        name: SuggestionName.BarChartHorizontalStackedPercent,
        options: {
          orientation: VizOrientation.Horizontal,
          stacking: StackingMode.Percent,
        },
      });
    }
  }
}
