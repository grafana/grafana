import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FieldColorModeId } from '@grafana/schema';
import { BarGaugeDisplayMode } from '@grafana/ui';

import { Options } from './panelcfg.gen';

export class BarGaugeSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options>({
      name: t('bargauge.suggestions.name', 'Bar gauge'),
      pluginId: 'bargauge',
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
            mode: FieldColorModeId.ContinuousGrYlRd,
          },
        },
        overrides: [],
      },
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    const list = this.getListAppender(builder);

    // This is probably not a good option for many numeric fields
    if (dataSummary.numberFieldCount > 50) {
      return;
    }

    // To use show individual row values we also need a string field to give each value a name
    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 30) {
      list.append({
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
              mode: FieldColorModeId.ContinuousGrYlRd,
            },
          },
          overrides: [],
        },
      });

      list.append({
        name: t('bargauge.suggestions.bar-lcd', 'Bar gauge (LCD)'),
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
              mode: FieldColorModeId.ContinuousGrYlRd,
            },
          },
          overrides: [],
        },
      });
    } else {
      list.append({
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
              mode: FieldColorModeId.ContinuousGrYlRd,
            },
          },
          overrides: [],
        },
      });

      list.append({
        name: t('bargauge.suggestions.bar-lcd', 'Bar gauge (LCD)'),
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
              mode: FieldColorModeId.ContinuousGrYlRd,
            },
          },
          overrides: [],
        },
      });
    }
  }
}
