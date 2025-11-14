import { defaultsDeep } from 'lodash';

import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplierFn } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode } from '@grafana/schema';

import { PieChartLabels, Options, PieChartType } from './panelcfg.gen';

const withDefaults = (suggestion: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
  defaultsDeep(suggestion, {
    options: {
      reduceOptions: {
        values: false,
        calcs: ['lastNotNull'],
      },
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

export const piechartSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options> = (dataSummary) => {
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

  let shouldDeaggregate = false;

  // we're filtering out data which has more than 30 slices or less than 2, and we're also
  // determining whether the reduce options should be set based on the data summary.
  if (dataSummary.hasFieldType(FieldType.string) && dataSummary.frameCount === 1) {
    if (dataSummary.rowCountTotal > 30 && dataSummary.rowCountTotal < 2) {
      return;
    }

    shouldDeaggregate = true;
  } else if (
    dataSummary.fieldCountByType(FieldType.number) > 30 ||
    dataSummary.fieldCountByType(FieldType.number) < 2
  ) {
    return;
  }

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
