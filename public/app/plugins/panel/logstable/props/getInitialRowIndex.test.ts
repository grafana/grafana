import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';

import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  parseLogsFrame,
} from '../../../../features/logs/logsFrame';

import { getInitialRowIndex } from './getInitialRowIndex';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
      { name: 'id', type: FieldType.string, values: ['abc_123', 'def_456'] },
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { service: 'frontend', level: 'info' },
          { service: 'backend', level: 'error' },
        ],
      },
    ],
  }),
];
const testLogsFrame = parseLogsFrame(testLogsDataFrame[0]);

describe('getInitialRowIndex', () => {
  it('should return undefined', () => {
    expect(getInitialRowIndex(undefined, null)).toBeUndefined();
    expect(getInitialRowIndex(undefined, testLogsFrame)).toBeUndefined();
    expect(getInitialRowIndex('abc_123', null)).toBeUndefined();
  });
  it('should return correct index', () => {
    expect(getInitialRowIndex('abc_123', testLogsFrame)).toEqual(0);
    expect(getInitialRowIndex('def_456', testLogsFrame)).toEqual(1);
  });
  it('should not return -1', () => {
    expect(getInitialRowIndex('nope', testLogsFrame)).toBeUndefined();
  });
});
