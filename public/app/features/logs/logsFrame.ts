import { DataFrame, FieldCache, FieldType, FieldWithIndex, DataFrameType, Labels } from '@grafana/data';

import { parseLegacyLogsFrame } from './legacyLogsFrame';

// these are like Labels, but their values can be
// arbitrary structures, not just strings
export type LogFrameLabels = Record<string, unknown>;

// the attributes-access is a little awkward, but it's necessary
// because there are multiple,very different dataFrame-representations.
export type LogsFrame = {
  timeField: FieldWithIndex;
  bodyField: FieldWithIndex;
  timeNanosecondField: FieldWithIndex | null;
  severityField: FieldWithIndex | null;
  idField: FieldWithIndex | null;
  getLogFrameLabels: () => LogFrameLabels[] | null; // may be slow, so we only do it when asked for it explicitly
  getLogFrameLabelsAsLabels: () => Labels[] | null; // temporarily exists to make the labels=>attributes migration simpler
  getLabelFieldName: () => string | null;
  extraFields: FieldWithIndex[];
};

function getField(cache: FieldCache, name: string, fieldType: FieldType): FieldWithIndex | undefined {
  const field = cache.getFieldByName(name);
  if (field === undefined) {
    return undefined;
  }

  return field.type === fieldType ? field : undefined;
}

const DATAPLANE_TIMESTAMP_NAME = 'timestamp';
const DATAPLANE_BODY_NAME = 'body';
const DATAPLANE_SEVERITY_NAME = 'severity';
const DATAPLANE_ID_NAME = 'id';
const DATAPLANE_LABELS_NAME = 'labels';

// NOTE: this is a hot fn, we need to avoid allocating new objects here
export function logFrameLabelsToLabels(logFrameLabels: LogFrameLabels): Labels {
  let needsSerialization = false;

  for (const k in logFrameLabels) {
    const v = logFrameLabels[k];

    if (typeof v !== 'string') {
      needsSerialization = true;
      break;
    }
  }

  if (needsSerialization) {
    let labels: Labels = {};

    for (const k in logFrameLabels) {
      const v = logFrameLabels[k];
      labels[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }

    return labels;
  }

  // @ts-ignore
  return logFrameLabels as Labels;
}

export function parseDataplaneLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);

  const timestampField = getField(cache, DATAPLANE_TIMESTAMP_NAME, FieldType.time);
  const bodyField = getField(cache, DATAPLANE_BODY_NAME, FieldType.string);

  // these two are mandatory
  if (timestampField === undefined || bodyField === undefined) {
    return null;
  }

  const severityField = getField(cache, DATAPLANE_SEVERITY_NAME, FieldType.string) ?? null;
  const idField = getField(cache, DATAPLANE_ID_NAME, FieldType.string) ?? null;
  const labelsField = getField(cache, DATAPLANE_LABELS_NAME, FieldType.other) ?? null;

  const labels = labelsField === null ? null : labelsField.values;

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timestampField.index &&
      i !== bodyField.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    timeField: timestampField,
    bodyField,
    severityField,
    idField,
    getLogFrameLabels: () => labels,
    timeNanosecondField: null,
    getLogFrameLabelsAsLabels: () => (labels !== null ? labels.map(logFrameLabelsToLabels) : null),
    getLabelFieldName: () => (labelsField !== null ? labelsField.name : null),
    extraFields,
  };
}

export function parseLogsFrame(frame: DataFrame): LogsFrame | null {
  if (frame.meta?.type === DataFrameType.LogLines) {
    return parseDataplaneLogsFrame(frame);
  } else {
    return parseLegacyLogsFrame(frame);
  }
}
