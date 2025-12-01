import { PanelDataSummary, VisualizationSuggestionScore, VisualizationSuggestionsSupplier } from '@grafana/data';
import icnTablePanelSvg from 'app/plugins/panel/table/img/icn-table-panel.svg';

import { Options, FieldConfig } from './panelcfg.gen';

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
        if (s.fieldConfig && s.fieldConfig.defaults.custom) {
          s.fieldConfig.defaults.custom.minWidth = 50;
        }
      },
      // If there is no data, suggest table anyway, but use icon instead of real preview
      // TODO: delete this in once "new" suggestions are fully rolled out
      imgSrc: dataSummary.fieldCount === 0 ? icnTablePanelSvg : undefined,
    },
  },
];
