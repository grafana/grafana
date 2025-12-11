import { defaultsDeep } from 'lodash';

import {
  FieldType,
  VisualizationSuggestion,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode } from '@grafana/schema';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

import { PieChartLabels, Options, PieChartType } from './panelcfg.gen';

const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
  defaultsDeep(suggestion, {
    options: {
      displayLabels: [PieChartLabels.Percent],
      legend: {
        calcs: [],
        displayMode: LegendDisplayMode.Hidden,
        placement: 'right',
        values: [],
        showLegend: false,
      },
    },
  } satisfies VisualizationSuggestion<Options>);

const SLICE_MAX = 30;
const SLICE_MIN = 2;

export const piechartSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  if (!dataSummary.hasFieldType(FieldType.number)) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [
    {
      name: t('piechart.suggestions.pie', 'Pie chart'),
    },
    {
      name: t('piechart.suggestions.donut', 'Donut chart'),
      options: {
        pieType: PieChartType.Donut,
      },
    },
  ];

  let shouldUseRawValues = false;

  // we're filtering out data which has more than 30 slices or less than 2, and we're also
  // determining whether the reduce options should be set based on the data summary.
  if (dataSummary.hasFieldType(FieldType.string) && dataSummary.frameCount === 1) {
    if (dataSummary.rowCountTotal > SLICE_MAX && dataSummary.rowCountTotal < SLICE_MIN) {
      return;
    }

    shouldUseRawValues = true;
  } else if (
    dataSummary.fieldCountByType(FieldType.number) > SLICE_MAX ||
    dataSummary.fieldCountByType(FieldType.number) < SLICE_MIN
  ) {
    return;
  }

  return suggestions.map((s) => {
    const result = defaultNumericVizOptions(withDefaults(s), dataSummary, shouldUseRawValues);
    // bump the score up to best if we have exactly one numeric and one string field
    if (
      dataSummary.fieldCount === 2 &&
      dataSummary.fieldCountByType(FieldType.string) === 1 &&
      dataSummary.fieldCountByType(FieldType.number) === 1
    ) {
      result.score = VisualizationSuggestionScore.Best;
    }
    return result;
  });
};
