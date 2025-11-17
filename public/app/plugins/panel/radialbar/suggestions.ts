import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';
import { GraphFieldConfig } from '@grafana/ui';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class GaugeSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    // for many fields / series this is probably not a good fit
    if (dataSummary.numberFieldCount >= 10) {
      return;
    }

    const list = builder.getListAppender<Options, GraphFieldConfig>({
      name: SuggestionName.Gauge,
      pluginId: 'gauge',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.options?.reduceOptions?.values) {
            s.options.reduceOptions.limit = 2;
          }
        },
      },
    });

    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        name: SuggestionName.Gauge,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });
      list.append({
        name: SuggestionName.GaugeCircular,
        options: {
          shape: 'circle',
          showThresholdMarkers: false,
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
        fieldConfig: {
          defaults: {
            color: { mode: FieldColorModeId.PaletteClassic },
          },
          overrides: [],
        },
      });
    } else {
      list.append({
        name: SuggestionName.Gauge,
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      });
      list.append({
        name: SuggestionName.GaugeCircular,
        options: {
          shape: 'circle',
          showThresholdMarkers: false,
          barWidthFactor: 0.3,
          effects: {
            rounded: true,
            barGlow: true,
            centerGlow: true,
            spotlight: true,
          },
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
        fieldConfig: {
          defaults: {
            color: { mode: FieldColorModeId.PaletteClassic },
          },
          overrides: [],
        },
      });
    }
  }
}
