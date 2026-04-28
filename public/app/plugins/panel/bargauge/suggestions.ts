import { defaultsDeep } from 'lodash';

import {
  FieldColorModeId,
  FieldType,
  type VisualizationSuggestion,
  type VisualizationSuggestionsSupplier,
  VizOrientation,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode } from '@grafana/ui/types';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { type Options } from './panelcfg.gen';

const MAX_PREVIEW_BARGAUGES = 6;

export const BARGAUGE_CARD_OPTIONS: VisualizationSuggestion<Options>['cardOptions'] = {
  maxSeries: MAX_PREVIEW_BARGAUGES,
  previewModifier: (s) => {
    if (s.options?.reduceOptions?.values) {
      s.options.reduceOptions.limit = MAX_PREVIEW_BARGAUGES;
    }
  },
};

const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
  defaultsDeep(suggestion, {
    options: {
      displayMode: BarGaugeDisplayMode.Basic,
      orientation: VizOrientation.Horizontal,
    },
    fieldConfig: {
      defaults: {
        color: {
          mode: FieldColorModeId.ContinuousGrYlRd,
        },
      },
      overrides: [],
    },
    cardOptions: BARGAUGE_CARD_OPTIONS,
  });

const BAR_LIMIT = 30;

export const barGaugeSugggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  // This is probably not a good option for many numeric fields
  if (dataSummary.fieldCountByType(FieldType.number) > BAR_LIMIT) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [
    { name: t('bargauge.suggestions.basic', 'Bar gauge') },
    {
      name: t('bargauge.suggestions.lcd', 'Bar gauge - LCD'),
      options: {
        displayMode: BarGaugeDisplayMode.Lcd,
      },
    },
  ];

  const shouldUseRawValues =
    dataSummary.hasFieldType(FieldType.string) &&
    dataSummary.frameCount === 1 &&
    dataSummary.rowCountTotal <= BAR_LIMIT;

  return suggestions.map((s) => defaultNumericVizOptions(withDefaults(s), dataSummary, shouldUseRawValues));
};
