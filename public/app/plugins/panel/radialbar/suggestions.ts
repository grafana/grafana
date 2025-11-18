import { defaultsDeep } from 'lodash';

import {
  FieldColorModeId,
  FieldType,
  VisualizationSuggestion,
  VisualizationSuggestionsSupplierFn,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';

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

export const radialBarSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options, GraphFieldConfig> = (
  dataSummary
) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) >= 10) {
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

  const shouldDeaggregate =
    dataSummary.hasFieldType(FieldType.string) && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10;

  return suggestions.map((s) => {
    s.options = s.options ?? {};
    s.fieldConfig = s.fieldConfig ?? {
      defaults: {},
      overrides: [],
    };

    if (shouldDeaggregate) {
      s.options.reduceOptions = {
        values: true,
        calcs: [],
      };
      s.fieldConfig.defaults.color = { mode: FieldColorModeId.PaletteClassic };
    } else {
      s.options.reduceOptions = {
        values: false,
        calcs: ['lastNotNull'],
      };
    }

    return withDefaults(s);
  });
};
