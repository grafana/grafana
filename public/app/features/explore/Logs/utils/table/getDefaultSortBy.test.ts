import { DataFrameType, FieldType, LogsSortOrder, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';

import { getDefaultTableSortBy } from './logsTable';

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
        values: ['log 1', 'log 2'],
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

describe('getDefaultTableSortBy', () => {
  it('should return default sort', () => {
    expect(getDefaultTableSortBy('', testLogsDataFrame[0], LogsSortOrder.Descending)).toEqual([
      {
        displayName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        desc: true,
      },
    ]);

    expect(getDefaultTableSortBy('', testLogsDataFrame[0], LogsSortOrder.Ascending)).toEqual([
      {
        displayName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        desc: false,
      },
    ]);
  });

  it('should return sort from local storage', () => {
    expect(
      getDefaultTableSortBy(
        JSON.stringify([{ displayName: 'timestamp', desc: false }]),
        testLogsDataFrame[0],
        LogsSortOrder.Descending
      )
    ).toEqual([
      {
        displayName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        desc: false,
      },
    ]);

    expect(
      getDefaultTableSortBy(
        JSON.stringify([{ displayName: 'foo', desc: true }]),
        testLogsDataFrame[0],
        LogsSortOrder.Descending
      )
    ).toEqual([
      {
        displayName: 'foo',
        desc: true,
      },
    ]);
  });
});
