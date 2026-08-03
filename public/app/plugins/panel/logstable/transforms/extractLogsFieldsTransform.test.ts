import { DataFrameType, type FieldDTO, FieldType, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

import { extractLogsFieldsTransforms } from './extractLogsFieldsTransform';

const timestampField: FieldDTO = { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] };
const bodyField: FieldDTO = { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] };
const labelsField: FieldDTO = {
  name: 'labels',
  type: FieldType.other,
  values: [
    { service: 'frontend', level: 'info' },
    { service: 'backend', level: 'error' },
  ],
};

/** Dataplane logs frame — the `other`-typed `labels` field plus `meta.type` is what is matched on. */
function makeLogsFrame(fields: FieldDTO[] = [timestampField, bodyField, labelsField]) {
  return toDataFrame({ meta: { type: DataFrameType.LogLines }, fields });
}

const extractLabels = {
  id: 'extractFields',
  options: { format: 'json', keepTime: false, replace: false, source: 'labels' },
};

describe('extractLogsFieldsTransforms', () => {
  it('sources an extractFields config from the labels field', () => {
    expect(extractLogsFieldsTransforms([makeLogsFrame()])).toEqual([extractLabels]);
  });

  it('collapses several frames carrying the same labels field into one config', () => {
    // transformDataFrame applies every config to every frame, so one config per frame would extract
    // `labels` twice — and extractFields renames colliding columns, yielding `service 1`/`level 1`.
    expect(extractLogsFieldsTransforms([makeLogsFrame(), makeLogsFrame()])).toEqual([extractLabels]);
  });

  it('returns no configs for a frame without a labels field', () => {
    expect(extractLogsFieldsTransforms([makeLogsFrame([timestampField, bodyField])])).toEqual([]);
  });

  it('returns no configs for an empty series', () => {
    expect(extractLogsFieldsTransforms([])).toEqual([]);
  });
});
