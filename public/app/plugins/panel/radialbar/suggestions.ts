import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FieldColorModeId } from '@grafana/schema';

import { Options } from './panelcfg.gen';

export class GaugeSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, {}>({
      name: t('gauge.suggestions.name', 'Gauge'),
      pluginId: 'radialbar', // TODO: change this to gauge when we consolidate
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.options!.reduceOptions.values) {
            s.options!.reduceOptions.limit = 2;
          }
        },
      },
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    // for many fields / series this is probably not a good fit
    if (dataSummary.numberFieldCount >= 10) {
      return;
    }

    const list = this.getListWithDefaults(builder);

    let optionsOverride: Partial<Options> = {};
    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      optionsOverride.reduceOptions = {
        values: true,
        calcs: [],
      };
    }

    list.append({ options: optionsOverride });
    list.append({
      name: t('gauge.suggestions.gauge-circular', 'Gauge (circular)'),
      options: {
        shape: 'circle',
        showThresholdMarkers: false,
        ...optionsOverride,
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
