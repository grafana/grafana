import { DataFrame, FieldCache, FieldType, Field, Labels } from '@grafana/data';

import type { LogsFrame } from './logsFrame';

function getLabels(frame: DataFrame, cache: FieldCache, lineField: Field): Labels[] | undefined {
  const useLabelsField = frame.meta?.custom?.frameType === 'LabeledTimeValues';

  if (!useLabelsField) {
    const lineLabels = lineField.labels;
    if (lineLabels != null) {
      const result = new Array(frame.length);
      result.fill(lineLabels);
      return result;
    } else {
      return undefined;
    }
  }

  const labelsField = cache.getFieldByName('labels');

  if (labelsField === undefined) {
    return undefined;
  }

  return labelsField.values;
}

export function parseLegacyLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);
  const timeField = cache.getFields(FieldType.time)[0];
  const bodyField = cache.getFields(FieldType.string)[0];

  // these two are mandatory
  if (timeField === undefined || bodyField === undefined) {
    return null;
  }

  const timeNanosecondField = cache.getFieldByName('tsNs');
  const severityField = cache.getFieldByName('level');
  const idField = cache.getFieldByName('id');

  const labels = getLabels(frame, cache, bodyField);

  return {
    timeField,
    bodyField,
    timeNanosecondField,
    severityField,
    idField,
    attributes: labels,
    getAttributesAsLabels: () => labels,
  };
}
