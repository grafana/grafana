import { VisualizationSuggestionsBuilder, VizOrientation } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { SuggestionName } from 'app/types/suggestions';

import { PanelOptions } from './models.gen';

export class BarGaugeSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    const list = builder.getListAppender<PanelOptions, {}>({
      name: '',
      pluginId: 'bargauge',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });

    // This is probably not a good option for many numeric fields
    if (dataSummary.numberFieldCount > 50) {
      return;
    }

    // To use show individual row values we also need a string field to give each value a name
    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 30) {
      list.append({
        name: SuggestionName.BarGaugeBasic,
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
        name: SuggestionName.BarGaugeLCD,
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
        name: SuggestionName.BarGaugeBasic,
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
        name: SuggestionName.BarGaugeLCD,
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
