import { DataFrame, FieldCache, FieldType, FieldWithIndex, DataFrameType, Labels } from '@grafana/data';

import { parseLegacyLogsFrame } from './legacyLogsFrame';

// these are like Labels, but their values can be
// arbitrary structures, not just strings
export type Attributes = Record<string, unknown>;

// the attributes-access is a little awkward, but it's necessary
// because there are multiple,very different dataframe-represenations.
export type LogsFrame = {
  timeField: FieldWithIndex;
  bodyField: FieldWithIndex;
  timeNanosecondField: FieldWithIndex | null;
  severityField: FieldWithIndex | null;
  idField: FieldWithIndex | null;
  attributes: Attributes[] | null;
  getAttributesAsLabels: () => Labels[] | null; // temporarily exists to make the labels=>attributes migration simpler
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
const DATAPLANE_ATTRIBUTES_NAME = 'attributes';

export function attributesToLabels(attributes: Attributes): Labels {
  const result: Labels = {};

  Object.entries(attributes).forEach(([k, v]) => {
    result[k] = typeof v === 'string' ? v : JSON.stringify(v);
  });

  return result;
}

function parseDataplaneLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);

  const timestampField = getField(cache, DATAPLANE_TIMESTAMP_NAME, FieldType.time);
  const bodyField = getField(cache, DATAPLANE_BODY_NAME, FieldType.string);

  // these two are mandatory
  if (timestampField === undefined || bodyField === undefined) {
    return null;
  }

  const severityField = getField(cache, DATAPLANE_SEVERITY_NAME, FieldType.string) ?? null;
  const idField = getField(cache, DATAPLANE_ID_NAME, FieldType.string) ?? null;
  const attributesField = getField(cache, DATAPLANE_ATTRIBUTES_NAME, FieldType.other) ?? null;

  const attributes = attributesField === null ? null : attributesField.values;

  return {
    timeField: timestampField,
    bodyField,
    severityField,
    idField,
    attributes,
    timeNanosecondField: null,
    getAttributesAsLabels: () => (attributes !== null ? attributes.map(attributesToLabels) : null),
  };
  return null;
}

export function parseLogsFrame(frame: DataFrame): LogsFrame | null {
  if (frame.meta?.type === DataFrameType.LogLines) {
    return parseDataplaneLogsFrame(frame);
  } else {
    return parseLegacyLogsFrame(frame);
  }
}
