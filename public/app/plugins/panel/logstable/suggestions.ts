import {
  DataFrameType,
  PanelDataSummary,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import icnTablePanelSvg from 'app/plugins/panel/table/img/icn-table-panel.svg';

import { FieldConfig as TableFieldConfig } from '../table/panelcfg.gen';

import { Options } from './options/types';

function getTableSuggestionScore(dataSummary: PanelDataSummary): VisualizationSuggestionScore | undefined {
  if (dataSummary.hasPreferredVisualisationType('logs')) {
    return VisualizationSuggestionScore.Best;
  }

  if (dataSummary.hasDataFrameType(DataFrameType.LogLines)) {
    return VisualizationSuggestionScore.Best;
  }

  return undefined;
}

export const logstableSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, TableFieldConfig> = (
  dataSummary
) => [
  {
    score: getTableSuggestionScore(dataSummary),
    cardOptions: {
      previewModifier: (s) => {
        if (s.options) {
          s.options.showHeader = false;
          s.options.disableKeyboardEvents = true;
        }
        if (s.fieldConfig && s.fieldConfig.defaults.custom) {
          s.fieldConfig.defaults.custom.minWidth = 50;
        }
      },
      // TODO: delete this in once "new" suggestions are fully rolled out
      imgSrc: dataSummary.fieldCount === 0 && !config.featureToggles.newVizSuggestions ? icnTablePanelSvg : undefined,
    },
  },
];
