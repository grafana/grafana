import {
  type PanelDataSummary,
  VisualizationSuggestionScore,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';

import { type Options, type FieldConfig } from './panelcfg.gen';

function getTableSuggestionScore(dataSummary: PanelDataSummary): VisualizationSuggestionScore {
  if (dataSummary.hasPreferredVisualisationType('table')) {
    return VisualizationSuggestionScore.Best;
  }

  // table is best suited to showing many fields with many rows.
  if (dataSummary.fieldCountMax > 5 && dataSummary.rowCountMax > 50) {
    return VisualizationSuggestionScore.Good;
  }

  return VisualizationSuggestionScore.OK;
}

export const tableSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, FieldConfig> = (dataSummary) => [
  {
    score: getTableSuggestionScore(dataSummary),
    cardOptions: {
      previewModifier: (s) => {
        s.options!.showHeader = false;
        s.options!.disableKeyboardEvents = true;
        if (s.fieldConfig && s.fieldConfig.defaults.custom) {
          s.fieldConfig.defaults.custom.minWidth = 50;
        }
      },
    },
  },
];
