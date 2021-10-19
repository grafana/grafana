import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export class BarGaugeSuggestionsSupplier {
  getDataSuggestions(builder: VisualizationSuggestionsBuilder) {
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

    const { dataSummary } = builder;

    if (dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
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
}
