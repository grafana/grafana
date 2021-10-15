import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode, StackingMode } from '@grafana/schema';
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
      s.fieldConfig!.defaults.custom!.lineWidth = 4;
    },
  });

  if (!builder.dataHasTimeField || !builder.dataHasNumberField) {
    return;
  }

  list.append({});

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
}
