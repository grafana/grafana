import {
  VisualizationSuggestionsBuilder,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './panelcfg.gen';

export class LogsPanelSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options>({
      name: t('logs.suggestions.name', 'Logs'),
      pluginId: 'logs',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary: ds } = builder;

    // Require a string & time field
    if (!ds.hasData || !ds.hasTimeField || !ds.hasStringField) {
      return;
    }

    this.getListAppender(builder).append({
      name: t('logs.suggestions.logs', 'Logs'),
      score:
        ds.preferredVisualisationType === 'logs' ? VisualizationSuggestionScore.Best : VisualizationSuggestionScore.OK,
    });
  }
}
