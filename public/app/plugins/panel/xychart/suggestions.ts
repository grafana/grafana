import { FieldType, VisualizationSuggestionScore, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options, FieldConfig } from './panelcfg.gen';

export const xychartSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, FieldConfig> = (ds) => {
  if (ds.fieldCountByType(FieldType.number) < 2) {
    return;
  }

  return [
    {
      name: t('xychart.suggestions.scatter-plot', 'Scatter plot'),
      score: ds.hasFieldType(FieldType.time) ? VisualizationSuggestionScore.OK : VisualizationSuggestionScore.Good,
    },
  ];
};
