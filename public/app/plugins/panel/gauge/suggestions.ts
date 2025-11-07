import { ThresholdsMode, VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './panelcfg.gen';

export class GaugeSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options>({
      name: t('gauge.suggestions.name', 'Gauge'),
      pluginId: 'gauge',
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
      fieldConfig: {
        defaults: {
          thresholds: {
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 70, color: 'orange' },
              { value: 85, color: 'red' },
            ],
            mode: ThresholdsMode.Percentage,
          },
          custom: {},
        },
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
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData || !dataSummary.hasNumberField) {
      return;
    }

    // for many fields / series this is probably not a good fit
    if (dataSummary.numberFieldCount >= 50) {
      return;
    }

    const list = this.getListAppender(builder);

    // To use show individual row values we also need a string field to give each value a name
    let optionsOverride: Partial<Options> = {};
    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      optionsOverride.reduceOptions = {
        values: true,
        calcs: [],
      };
    }

    list.append({ options: optionsOverride });
    list.append({
      name: t('gauge.suggestions.gauge-no-thresholds', 'Gauge (no thresholds)'),
      options: {
        showThresholdMarkers: false,
        ...optionsOverride,
      },
    });
  }
}
