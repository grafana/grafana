import { DataFrame, FieldCache, FieldType, Field, Labels, FieldWithIndex } from '@grafana/data';

import type { LogsFrame } from './logsFrame';

// take the labels from the line-field, and "stretch" it into an array
// with the length of the frame (so there are the same labels for every row)
function makeLabelsArray(lineField: Field, length: number): Labels[] | null {
  const lineLabels = lineField.labels;
  if (lineLabels !== undefined) {
    const result = new Array(length);
    result.fill(lineLabels);
    return result;
  } else {
    return null;
  }
}

// we decide if the frame is old-loki-style frame, and adjust the behavior.
// we also have to return the labels-field (if we used it),
// to be able to remove it from the unused-fields, later.
function makeLabelsGetter(
  cache: FieldCache,
  lineField: Field,
  frame: DataFrame
): [FieldWithIndex | null, () => Labels[] | null] {
  if (frame.meta?.custom?.frameType === 'LabeledTimeValues') {
    const labelsField = cache.getFieldByName('labels');
    return labelsField === undefined ? [null, () => null] : [labelsField, () => labelsField.values];
  } else {
    // we use the labels on the line-field, and make an array with it
    return [null, () => makeLabelsArray(lineField, frame.length)];
  }
}

export function parseLegacyLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);
  const timeField = cache.getFirstFieldOfType(FieldType.time);
  const bodyField = cache.getFirstFieldOfType(FieldType.string);

  // these two are mandatory
  if (timeField === undefined || bodyField === undefined) {
    return null;
  }

  const timeNanosecondField = cache.getFieldByName('tsNs') ?? null;
  const severityField = cache.getFieldByName('level') ?? null;
  const idField = cache.getFieldByName('id') ?? null;

  // extracting the labels is done very differently for old-loki-style and simple-style
  // dataframes, so it's a little awkward to handle it,
  // we both need to on-demand extract the labels, and also get teh labelsField,
  // but only if the labelsField is used.
  const [labelsField, getL] = makeLabelsGetter(cache, bodyField, frame);

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timeField.index &&
      i !== bodyField.index &&
      i !== timeNanosecondField?.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    timeField,
    bodyField,
    timeNanosecondField,
    severityField,
    idField,
    getAttributes: getL,
    getAttributesAsLabels: getL,
    extraFields,
  };
}
