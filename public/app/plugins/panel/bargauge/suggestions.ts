import { defaultsDeep } from 'lodash';

import {
  FieldColorModeId,
  FieldType,
  VisualizationSuggestion,
  VisualizationSuggestionsSupplier,
  VizOrientation,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeDisplayMode } from '@grafana/ui';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

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
