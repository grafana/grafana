import { of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { dateTime } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { createLokiDatasource } from './mocks';
import { runPartitionedQuery } from './querySplitting';
import { LokiQuery } from './types';

describe('runPartitionedQuery()', () => {
  let datasource: LokiDatasource;
  const request = getQueryOptions<LokiQuery>({
    targets: [{ expr: 'count_over_time({a="b"}[1m])', refId: 'A' }],
    range: {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-10T06:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T05:00:00.000Z'),
        to: dateTime('2023-02-10T06:00:00.000Z'),
      },
    },
  });
  beforeEach(() => {
    datasource = createLokiDatasource();
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [] }));
  });

  test('Splits datasource queries', async () => {
    await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
      // 3 days, 3 chunks, 3 requests.
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });
});
