import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { GaugeOptions } from './types';

export function getSuggestions(builder: VisualizationSuggestionsBuilder) {
  if (!builder.dataExists) {
    return;
  }

  const list = builder.getListAppender<GaugeOptions, {}>({
    name: 'Gauge',
    pluginId: 'gauge',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      if (s.options!.reduceOptions.values) {
        s.options!.reduceOptions.limit = 2;
      }
    },
  });

  if (builder.dataFrameCount === 1 && builder.dataRowCount < 10) {
    list.append({
      options: {
        reduceOptions: {
          values: true,
          calcs: [],
        },
      },
    });
  } else {
    list.append({
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
    });
  }
}
