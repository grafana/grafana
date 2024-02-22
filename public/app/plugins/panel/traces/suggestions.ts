import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

export class TracesSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}, {}>({
      name: SuggestionName.Trace,
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
        name: SuggestionName.Trace,
        score: VisualizationSuggestionScore.Best,
      });
    }
  }
}
