import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { t } from '@grafana/i18n';

export class TracesSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}, {}>({
      name: t('trace.suggestions.name', 'Trace'),
      pluginId: 'traces',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data) {
      return;
    }

    const dataFrame = builder.data.series[0];
    if (!dataFrame) {
      return;
    }

    if (builder.data.series[0].meta?.preferredVisualisationType === 'trace') {
      this.getListWithDefaults(builder).append({
        score: VisualizationSuggestionScore.Best,
      });
    }
  }
}
