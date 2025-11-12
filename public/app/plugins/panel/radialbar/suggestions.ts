import { defaultsDeep } from 'lodash';

import { FieldColorModeId, FieldType, VisualizationSuggestion, VisualizationSuggestionsHandler } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';

import { Options } from './panelcfg.gen';

export const radialBarSuggestionsHandler: VisualizationSuggestionsHandler<Options, GraphFieldConfig> = (
  dataSummary
) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) >= 10) {
    return;
  }

  const withDefaults = (
    suggestion: VisualizationSuggestion<Options, GraphFieldConfig>
  ): VisualizationSuggestion<Options, GraphFieldConfig> => {
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
        defaults: isTabularData
          ? {
              color: { mode: FieldColorModeId.PaletteClassic },
            }
          : {},
        overrides: [],
      },
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
  };

  return [
    withDefaults({ name: t('gauge.suggestions.arc', 'Gauge') }),
    withDefaults({
      name: t('gauge.suggestions.circular', 'Circular gauge'),
      options: {
        shape: 'circle',
        showThresholdMarkers: false,
        barWidthFactor: 0.3,
      },
    }),
  ];
};
