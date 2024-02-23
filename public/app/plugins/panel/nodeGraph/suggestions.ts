import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

export class NodeGraphSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}, {}>({
      name: SuggestionName.NodeGraph,
      pluginId: 'nodeGraph',
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

    if (builder.dataSummary.preferredVisualisationType === 'nodeGraph') {
      this.getListWithDefaults(builder).append({
        name: SuggestionName.NodeGraph,
        score: VisualizationSuggestionScore.Best,
      });
    }
  }
}
