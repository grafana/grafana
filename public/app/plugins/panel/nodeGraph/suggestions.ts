import { DataFrame, FieldType, VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

export class NodeGraphSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}, {}>({
      name: SuggestionName.NodeGraph,
      pluginId: 'nodeGraph',
    });
  }

  hasCorrectFields(frames: DataFrame[]): boolean {
    let hasNodesFrame = false;
    let hasEdgesFrame = false;

    const nodeFields: Array<[string, FieldType[]]> = [
      ['id', [FieldType.string]],
      ['title', [FieldType.string]],
      ['mainstat', [FieldType.number]],
    ];
    const edgeFields: Array<[string, FieldType[]]> = [
      ['id', [FieldType.string]],
      ['source', [FieldType.string]],
      ['target', [FieldType.string]],
    ];

    for (const frame of frames) {
      if (this.checkFields(nodeFields, frame)) {
        hasNodesFrame = true;
      }
      if (this.checkFields(edgeFields, frame)) {
        hasEdgesFrame = true;
      }
    }

    return hasNodesFrame && hasEdgesFrame;
  }

  checkFields(fields: Array<[string, FieldType[]]>, frame: DataFrame): boolean {
    let hasCorrectFields = true;

    for (const field of fields) {
      const [name, types] = field;
      const frameField = frame.fields.find((f) => f.name === name);
      if (!frameField || !types.includes(frameField.type)) {
        hasCorrectFields = false;
        break;
      }
    }

    return hasCorrectFields ? true : false;
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data) {
      return;
    }

    const hasCorrectFields = this.hasCorrectFields(builder.data.series);
    if (hasCorrectFields) {
      this.getListWithDefaults(builder).append({
        name: SuggestionName.NodeGraph,
        score: VisualizationSuggestionScore.Best,
      });
    }
  }
}
