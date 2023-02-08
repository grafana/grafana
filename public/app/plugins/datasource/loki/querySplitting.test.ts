import { of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { DataQueryRequest, dateTime, TimeRange } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { createLokiDatasource } from './mocks';
import { runPartitionedQuery } from './querySplitting';
import { partitionTimeRange } from './queryUtils';
import { LokiQuery } from './types';

jest.mock('./queryUtils');

jest.mock('./queryUtils', () => {
  return {
    ...jest.requireActual('./queryUtils'),
    partitionTimeRange: jest.fn(),
  };
});

describe('runPartitionedQuery()', () => {
  let datasource: LokiDatasource;
  const timeRanges: TimeRange[] = [
    {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-08T06:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T05:00:00.000Z'),
        to: dateTime('2023-02-08T06:00:00.000Z'),
      },
    },
    {
      from: dateTime('2023-02-08T06:00:00.000Z'),
      to: dateTime('2023-02-08T07:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T06:00:00.000Z'),
        to: dateTime('2023-02-08T07:00:00.000Z'),
      },
    },
  ];
  const request = getQueryOptions<LokiQuery>({
    targets: [{ expr: 'count_over_time({a="b"}[1m])', refId: 'A' }],
  });
  beforeEach(() => {
    datasource = createLokiDatasource();
    jest.mocked(partitionTimeRange).mockReturnValue(timeRanges);
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [] }));
  });

  test('Splits datasource queries', async () => {
    await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.runQuery).toHaveBeenCalledTimes(timeRanges.length);
    });
  });
});
