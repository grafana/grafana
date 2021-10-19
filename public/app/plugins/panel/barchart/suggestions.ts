import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { LegendDisplayMode, StackingMode, VisibilityMode } from '@grafana/schema';
import { BarChartFieldConfig, BarChartOptions } from './types';

export class BarChartSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<BarChartOptions, BarChartFieldConfig>({
      name: 'Bar chart',
      pluginId: 'barchart',
      options: {
        showValue: VisibilityMode.Never,
        legend: {
          displayMode: LegendDisplayMode.Hidden,
          placement: 'right',
        } as any,
      },
      fieldConfig: {
        defaults: {
          unit: 'short',
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {
        s.options!.barWidth = 0.8;
      },
    });
  }

  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const list = this.getListWithDefaults(builder);
    const { dataSummary } = builder;

    if (dataSummary.frameCount !== 1) {
      return;
    }

    if (!dataSummary.hasNumberField || !dataSummary.hasStringField) {
      return;
    }

    list.append({});
    list.append({
      name: 'Bar chart horizontal',
      options: {
        orientation: VizOrientation.Horizontal,
      },
    });

    if (dataSummary.numberFieldCount > 1) {
      list.append({
        name: 'Bar chart stacked',
        options: {
          stacking: StackingMode.Normal,
        },
      });
      list.append({
        name: 'Bar chart stacked horizontal',
        options: {
          stacking: StackingMode.Normal,
          orientation: VizOrientation.Horizontal,
        },
      });
    }
  }
}
