import { DataFrameType, FieldType, LogsSortOrder, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

import { getDefaultSortBy } from './logsTable';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      {
        name: LOGS_DATAPLANE_BODY_NAME,
        type: FieldType.string,
        values: ['log 1', 'log 2'], // Add display function
      },
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

describe('getDefaultSortBy', () => {
  it('should return default sort', () => {
    expect(getDefaultSortBy(testLogsDataFrame[0], LogsSortOrder.Descending)).toEqual([
      {
        displayName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        desc: true,
      },
    ]);

    expect(getDefaultSortBy(testLogsDataFrame[0], LogsSortOrder.Ascending)).toEqual([
      {
        displayName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        desc: false,
      },
    ]);
  });
});
