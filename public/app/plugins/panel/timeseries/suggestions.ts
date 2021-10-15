import { VisualizationSuggestionsBuilder } from '@grafana/data';
import {
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
} from '@grafana/schema';
import { TimeSeriesOptions } from './types';

export function getSuggestions(builder: VisualizationSuggestionsBuilder) {
  if (!builder.dataExists) {
    return;
  }

  const list = builder.getListAppender<TimeSeriesOptions, GraphFieldConfig>({
    name: 'Line chart',
    pluginId: 'timeseries',
    options: {
      legend: {} as any,
    },
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      s.options!.legend.displayMode = LegendDisplayMode.Hidden;

      if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
        s.fieldConfig!.defaults.custom!.lineWidth = 4;
      }
    },
  });

  if (!builder.dataHasTimeField || !builder.dataHasNumberField) {
    return;
  }

  list.append({});

  if (builder.dataRowCountMax < 200) {
    list.append({
      name: 'Line chart smooth',
      fieldConfig: {
        defaults: {
          custom: {
            lineInterpolation: LineInterpolation.Smooth,
          },
        },
        overrides: [],
      },
    });
  }

  if (builder.dataNumberFieldCount === 1) {
    list.append({
      name: 'Area chart',
      fieldConfig: {
        defaults: {
          custom: {
            fillOpacity: 25,
          },
        },
        overrides: [],
      },
    });
  } else {
    // If more than 1 series suggest stacked chart
    list.append({
      name: 'Area chart stacked',
      fieldConfig: {
        defaults: {
          custom: {
            fillOpacity: 25,
            stacking: {
              mode: StackingMode.Normal,
              group: 'A',
            },
          },
        },
        overrides: [],
      },
    });
  }

  if (builder.dataRowCountTotal / builder.dataNumberFieldCount < 100) {
    list.append({
      name: 'Bar chart with time x-axis',
      fieldConfig: {
        defaults: {
          custom: {
            drawStyle: GraphDrawStyle.Bars,
            fillOpacity: 100,
            lineWidth: 1,
            gradientMode: GraphGradientMode.Hue,
            stacking: {
              mode: StackingMode.Normal,
              group: 'A',
            },
          },
        },
        overrides: [],
      },
    });
  }
}
