import { DataFrame, FieldCache, FieldType, FieldWithIndex, Labels } from '@grafana/data';

export type LogsFrame = {
  timeField: FieldWithIndex;
  lineField: FieldWithIndex;
  timeNanosecondField?: FieldWithIndex;
  logLevelField?: FieldWithIndex;
  idField?: FieldWithIndex;
  getLabels: () => Labels[];
};

export function parseLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);
  const timeField = cache.getFields(FieldType.time)[0];
  const lineField = cache.getFields(FieldType.string)[0];

  // these two are mandatory
  if (timeField === undefined || lineField === undefined) {
    return null;
  }

  const timeNanosecondField = cache.getFieldByName('tsNs');
  const logLevelField = cache.getFieldByName('level');
  const idField = cache.getFieldByName('id');

  // we only extract the labels when we are asked to do so,
  // because this is usually not needed
  const getLabels = (): Labels[] => {
    // NOTE: this is experimental, please do not use in your code.
    // we will get this custom-frame-type into the "real" frame-type list soon,
    // but the name might change, so please do not use it until then.
    const useLabelsField = frame.meta?.custom?.frameType === 'LabeledTimeValues';

    if (useLabelsField) {
      const labelsField = cache.getFieldByName('labels');
      if (labelsField != null) {
        return labelsField.values.toArray();
      } else {
        // this should not really happen, let's return empty-labels
        return Array(frame.length).fill({});
      }
    } else {
      return Array(lineField.values.length).fill(lineField.labels ?? {});
    }
  };

  return {
    timeField,
    lineField,
    timeNanosecondField,
    logLevelField,
    idField,
    getLabels,
  };
}
