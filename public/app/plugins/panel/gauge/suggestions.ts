import { defaultsDeep } from 'lodash';

import { ThresholdsMode, FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplierFn } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './panelcfg.gen';

const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> => {
  return defaultsDeep(suggestion, {
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
  } satisfies VisualizationSuggestion<Options>);
};

export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) >= 10) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [
    { name: t('gauge.suggestions.arc', 'Gauge') },
    {
      name: t('gauge.suggestions.no-thresholds', 'Gauge - no thresholds'),
      options: {
        showThresholdMarkers: false,
      },
    },
  ];

  // sometimes, we want to de-aggregate the data for the gauge suggestion
  const shouldDeaggregate =
    dataSummary.hasFieldType(FieldType.string) && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10;

  return suggestions.map((s) => {
    if (shouldDeaggregate) {
      s.options = s.options ?? {};
      s.options.reduceOptions = {
        values: true,
        calcs: [],
      };
    }

    return withDefaults(s);
  });
};
