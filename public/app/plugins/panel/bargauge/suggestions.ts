import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export function getSuggestions(builder: VisualizationSuggestionsBuilder) {
  const list = builder.getListAppender<BarGaugeOptions, {}>({
    name: 'Bar gauge',
    pluginId: 'bargauge',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {},
  });

  if (builder.dataFrameCount === 1 && builder.dataRowCountTotal < 10) {
    list.append({
      name: 'Bar gauge horizontal retro lcd',
      options: {
        reduceOptions: {
          values: true,
          calcs: [],
        },
        displayMode: BarGaugeDisplayMode.Lcd,
        orientation: VizOrientation.Horizontal,
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: 'continuous-GrYlRd',
          },
        },
        overrides: [],
      },
    });
  } else {
    list.append({
      name: 'Bar gauge horizontal retro lcd',
      options: {
        displayMode: BarGaugeDisplayMode.Lcd,
        orientation: VizOrientation.Horizontal,
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: 'continuous-GrYlRd',
          },
        },
        overrides: [],
      },
    });
  }
}
