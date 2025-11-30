import { defaultsDeep } from 'lodash';

import { ThresholdsMode, FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
  defaultsDeep(suggestion, {
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

const GAUGE_LIMIT = 10;

export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) > GAUGE_LIMIT) {
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
  const shouldUseRawValues =
    dataSummary.hasFieldType(FieldType.string) &&
    dataSummary.frameCount === 1 &&
    dataSummary.rowCountTotal <= GAUGE_LIMIT;

  return suggestions.map((s) => defaultNumericVizOptions(withDefaults(s), dataSummary, shouldUseRawValues));
};
