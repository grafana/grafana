import { defaultsDeep } from 'lodash';

import {
  FieldColorModeId,
  FieldConfigSource,
  FieldType,
  VisualizationSuggestion,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

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
      },
    },
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

  const suggestedRange = dataSummary.rawFrames?.reduce(
    ([min, max], frame) => {
      let newMin = min;
      let newMax = max;
      for (const f of frame.fields) {
        if (f.type !== FieldType.number) {
          continue;
        }
        newMin = Math.min(newMin, f.state?.calcs?.min ?? Infinity);
        newMax = Math.max(newMax, f.state?.calcs?.max ?? -Infinity);
      }
      return [newMin, newMax];
    },
    [Infinity, -Infinity]
  );

  let fieldConfig: FieldConfigSource<Partial<GraphFieldConfig>> | undefined = undefined;
  if (suggestedRange && suggestedRange.every(isFinite)) {
    const delta = suggestedRange[1] - suggestedRange[0];
    fieldConfig = {
      defaults: {
        min: Math.floor(suggestedRange[0] - delta * 0.1),
        max: Math.ceil(suggestedRange[1] + delta * 0.1),
      },
      overrides: [],
    };
  }

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
