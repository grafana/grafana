import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export class BarGaugeSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
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

    if (!dataSummary.hasNumberField) {
      return;
    }

    // This is probably not a good option for many numeric fields
    if (dataSummary.numberFieldCount > 50) {
      return;
    }

    // To use show individual row values we also need a string field to give each value a name
    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 30) {
      list.append({
        name: 'Bar gauge',
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
          displayMode: BarGaugeDisplayMode.Basic,
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

      list.append({
        name: 'Bar gauge LCD',
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
        name: 'Bar gauge',
        options: {
          displayMode: BarGaugeDisplayMode.Basic,
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

      list.append({
        name: 'Bar gauge LCD',
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
