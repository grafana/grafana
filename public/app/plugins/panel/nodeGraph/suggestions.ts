import { DataFrame, FieldType, VisualizationSuggestionScore, VisualizationSuggestionsSupplierFn } from '@grafana/data';

import { Options } from './panelcfg.gen';

function checkFields(fields: Array<[string, FieldType]>, frame: DataFrame): boolean {
  let hasCorrectFields = true;

  for (const field of fields) {
    const [name, type] = field;
    const frameField = frame.fields.find((f) => f.name === name);
    if (!frameField || type !== frameField.type) {
      hasCorrectFields = false;
      break;
    }
  }

  return hasCorrectFields;
}

function frameHasCorrectFields(frames: DataFrame[]): boolean {
  let hasNodesFrame = false;
  let hasEdgesFrame = false;

  const nodeFields: Array<[string, FieldType]> = [
    ['id', FieldType.string],
    ['title', FieldType.string],
    ['mainstat', FieldType.number],
  ];
  const edgeFields: Array<[string, FieldType]> = [
    ['id', FieldType.string],
    ['source', FieldType.string],
    ['target', FieldType.string],
  ];

  for (const frame of frames) {
    if (checkFields(nodeFields, frame)) {
      hasNodesFrame = true;
    }
    if (checkFields(edgeFields, frame)) {
      hasEdgesFrame = true;
    }
  }

  return hasNodesFrame && hasEdgesFrame;
}

export const nodeGraphSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options> = (dataSummary) => {
  if (!dataSummary._data) {
    return;
  }

  const hasCorrectFields = frameHasCorrectFields(dataSummary._data);
  const nodeGraphFrames = dataSummary._data.filter(
    (df) => df.meta && df.meta.preferredVisualisationType === 'nodeGraph'
  );

  if (!hasCorrectFields && nodeGraphFrames.length < 2) {
    return;
  }

  return [{ score: VisualizationSuggestionScore.Best }];
};
