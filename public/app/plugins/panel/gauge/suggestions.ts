import { defaultsDeep } from 'lodash';

import { FieldType } from '@grafana/data/dataframe';
import {
  FieldColorModeId,
  type FieldConfigSource,
  type VisualizationSuggestion,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { type GraphFieldConfig } from '@grafana/ui';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { type Options } from './panelcfg.gen';

const withDefaults = (
  suggestion: VisualizationSuggestion<Options, GraphFieldConfig>
): VisualizationSuggestion<Options, GraphFieldConfig> =>
  defaultsDeep(suggestion, {
    options: {
      barWidthFactor: 0.3,
      showThresholdMarkers: false,
    },
    cardOptions: {
      previewModifier: (s) => {
        if (s.options?.reduceOptions) {
          s.options.reduceOptions.limit = 4;
        }
        if (s.fieldConfig) {
          s.fieldConfig.defaults.unit = 'short';
        }
      },
    },
  } satisfies VisualizationSuggestion<Options, GraphFieldConfig>);

const MAX_GAUGES = 10;

export const gaugeSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // for many fields / series this is probably not a good fit
  if (dataSummary.fieldCountByType(FieldType.number) > MAX_GAUGES) {
    return;
  }

  const fieldConfig: FieldConfigSource<Partial<GraphFieldConfig>> = {
    defaults: {},
    overrides: [],
  };

  const suggestions: Array<VisualizationSuggestion<Options, GraphFieldConfig>> = [
    {
      name: t('gauge.suggestions.arc', 'Gauge'),
      fieldConfig,
      options: { shape: 'gauge' },
    },
    {
      name: t('gauge.suggestions.circular', 'Circular gauge'),
      fieldConfig,
      options: { shape: 'circle' },
    },
  ];

  const shouldUseRawValues =
    dataSummary.hasFieldType(FieldType.string) &&
    dataSummary.frameCount === 1 &&
    dataSummary.rowCountTotal <= MAX_GAUGES;

  const showSparkline =
    !shouldUseRawValues && dataSummary.rowCountTotal > 1 && dataSummary.hasFieldType(FieldType.time);

  return suggestions.map((s) => {
    const suggestion = defaultNumericVizOptions(withDefaults(s), dataSummary, shouldUseRawValues);

    suggestion.options = suggestion.options ?? {};
    suggestion.options.sparkline = showSparkline;

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
