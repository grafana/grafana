import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class GaugeSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    // for many fields / series this is probably not a good fit
    if (dataSummary.numberFieldCount >= 50) {
      return;
    }

    const list = builder.getListAppender<Options, {}>({
      name: SuggestionName.Gauge,
      pluginId: 'gauge',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.options!.reduceOptions.values) {
            s.options!.reduceOptions.limit = 2;
          }
        },
      },
    });

    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        name: SuggestionName.RadialBar,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });
    } else {
      list.append({
        name: SuggestionName.RadialBar,
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      });
    }
  }
}
