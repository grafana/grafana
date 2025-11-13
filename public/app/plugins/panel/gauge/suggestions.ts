import { defaultsDeep } from 'lodash';

import { ThresholdsMode, FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplierFn } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './panelcfg.gen';

export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) >= 10) {
    return;
  }

  const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> => {
    // if there is a string field and there are few enough rows, we assume it's tabular data and not numeric series data,
    // and the de-aggregated version of the viz probably makes more sense
    const isTabularData =
      dataSummary.hasFieldType(FieldType.string) && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10;
    return defaultsDeep(suggestion, {
      options: {
        reduceOptions: isTabularData
          ? {
              values: true,
              calcs: [],
            }
          : {
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
    } satisfies VisualizationSuggestion<Options>);
  };

  return [
    withDefaults({ name: t('gauge.suggestions.arc', 'Gauge') }),
    withDefaults({
      name: t('gauge.suggestions.no-thresholds', 'Gauge - no thresholds'),
      options: {
        showThresholdMarkers: false,
      },
    }),
  ];
};
