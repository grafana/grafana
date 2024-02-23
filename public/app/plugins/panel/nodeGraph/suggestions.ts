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

    const dataFrames = builder.data.series.filter(
      (df) => df.meta && df.meta.preferredVisualisationType === 'nodeGraph'
    );
    // one frame for nodes, one frame for edges
    if (dataFrames.length !== 2) {
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
