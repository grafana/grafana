import { defaultsDeep } from 'lodash';

import { FieldColorModeId, FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

const withDefaults = (
  suggestion: VisualizationSuggestion<Options, GraphFieldConfig>
): VisualizationSuggestion<Options, GraphFieldConfig> =>
  defaultsDeep(suggestion, {
    cardOptions: {
      previewModifier: (s) => {
        if (s.options?.reduceOptions) {
          s.options.reduceOptions.limit = 4;
        }
      },
    },
    // styles: [{
    //   name: t('gauge.suggestions.style.circular', 'Glowing'),
    //   options: {
    //     effects: {
    //       rounded: true,
    //       barGlow: true,
    //       centerGlow: true,
    //       spotlight: true,
    //     },
    //   },
    // }, {
    //   name: t('gauge.suggestions.style.simple', 'Simple'),
    // }]
  } satisfies VisualizationSuggestion<Options, GraphFieldConfig>);

const MAX_GAUGES = 10;

export const radialBarSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (
  dataSummary
) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) > MAX_GAUGES) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options, GraphFieldConfig>> = [
    { name: t('gauge.suggestions.arc', 'Gauge') },
    {
      name: t('gauge.suggestions.circular', 'Circular gauge'),
      options: {
        shape: 'circle',
        showThresholdMarkers: false,
        barWidthFactor: 0.3,
      },
    },
  ];

  const shouldUseRawValues =
    dataSummary.hasFieldType(FieldType.string) &&
    dataSummary.frameCount === 1 &&
    dataSummary.rowCountTotal <= MAX_GAUGES;

  return suggestions.map((s) => {
    const suggestion = defaultNumericVizOptions(withDefaults(s), dataSummary, shouldUseRawValues);

    if (shouldUseRawValues) {
      suggestion.fieldConfig = suggestion.fieldConfig ?? {
        defaults: {},
        overrides: [],
      };
      suggestion.fieldConfig.defaults.color = suggestion.fieldConfig.defaults.color ?? {
        mode: FieldColorModeId.PaletteClassic,
      };
    }

    return suggestion;
  });
};
