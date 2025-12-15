import { defaultsDeep } from 'lodash';

import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LegendDisplayMode, StackingMode, VisibilityMode } from '@grafana/schema';

import { FieldConfig, Options } from './panelcfg.gen';

const withDefaults = (suggestion: VisualizationSuggestion<Options, FieldConfig>) =>
  defaultsDeep(suggestion, {
    options: {
      showValue: VisibilityMode.Never,
      legend: {
        calcs: [],
        displayMode: LegendDisplayMode.List,
        showLegend: true,
        placement: 'right',
      },
    },
    fieldConfig: {
      defaults: {
        unit: 'short',
        custom: {},
      },
      overrides: [],
    },
    cardOptions: {
      previewModifier: (s) => {
        s.options!.barWidth = 0.8;
        s.fieldConfig!.defaults!.custom!.hideFrom = { tooltip: false, legend: true, viz: false }; // hide legend in preview
      },
    },
  } satisfies VisualizationSuggestion<Options, FieldConfig>);

export const barchartSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, FieldConfig> = (dataSummary) => {
  if (dataSummary.frameCount !== 1) {
    return;
  }

  if (!dataSummary.hasFieldType(FieldType.number) || !dataSummary.hasFieldType(FieldType.string)) {
    return;
  }

  // if you have this many rows barchart might not be a good fit
  if (dataSummary.rowCountTotal > 50) {
    return;
  }

  const result: Array<VisualizationSuggestion<Options, FieldConfig>> = [
    {
      name: t('barchart.suggestions.vertical', 'Bar chart'),
    },
  ];

  if (dataSummary.fieldCountByType(FieldType.number) > 1) {
    result.push(
      {
        name: t('barchart.suggestions.vert-stacked', 'Bar chart - stacked'),
        options: {
          stacking: StackingMode.Normal,
        },
      },
      {
        name: t('barchart.suggestions.vert-stacked-percent', 'Bar chart - stacked by percentage'),
        options: {
          stacking: StackingMode.Percent,
        },
        fieldConfig: {
          overrides: [],
          defaults: {
            unit: 'percentunit',
          },
        },
      }
    );
  }

  // horizontal bars
  result.push({
    name: t('barchart.suggestions.horizontal', 'Horizontal bar chart'),
    options: {
      orientation: VizOrientation.Horizontal,
    },
  });

  if (dataSummary.fieldCountByType(FieldType.number) > 1) {
    result.push(
      {
        name: t('barchart.suggestions.hz-stacked', 'Horizontal bar chart - stacked'),
        options: {
          orientation: VizOrientation.Horizontal,
          stacking: StackingMode.Normal,
        },
      },
      {
        name: t('barchart.suggestions.hz-stacked-percent', 'Horizontal bar chart - stacked by percentage'),
        options: {
          orientation: VizOrientation.Horizontal,
          stacking: StackingMode.Percent,
        },
        fieldConfig: {
          overrides: [],
          defaults: {
            unit: 'percentunit',
          },
        },
      }
    );
  }

  return result.map(withDefaults);
};
