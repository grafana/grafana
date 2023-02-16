import { of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { dateTime } from '@grafana/data';

import { LokiDatasource } from './datasource';
import * as logsTimeSplit from './logsTimeSplit';
import * as metricTimeSplit from './metricTimeSplit';
import { createLokiDatasource, getMockFrames } from './mocks';
import { runPartitionedQuery } from './querySplitting';
import { LokiQuery } from './types';

describe('runPartitionedQuery()', () => {
  let datasource: LokiDatasource;
  const range = {
    from: dateTime('2023-02-08T05:00:00.000Z'),
    to: dateTime('2023-02-10T06:00:00.000Z'),
    raw: {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-10T06:00:00.000Z'),
    },
  };
  const request = getQueryOptions<LokiQuery>({
    targets: [{ expr: 'count_over_time({a="b"}[1m])', refId: 'A' }],
    range,
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

  describe('Hidden queries', () => {
    const request = getQueryOptions<LokiQuery>({
      targets: [
        { expr: 'count_over_time({a="b"}[1m])', refId: 'A', hide: true },
        { expr: '{a="b"}', refId: 'B' },
      ],
      range,
    });
    beforeAll(() => {
      jest.spyOn(logsTimeSplit, 'getRangeChunks').mockReturnValue([]);
      jest.spyOn(metricTimeSplit, 'getRangeChunks').mockReturnValue([]);
    });
    afterAll(() => {
      jest.mocked(logsTimeSplit.getRangeChunks).mockRestore();
      jest.mocked(metricTimeSplit.getRangeChunks).mockRestore();
    });
    test('Ignores hidden queries', async () => {
      await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
        expect(logsTimeSplit.getRangeChunks).toHaveBeenCalled();
        expect(metricTimeSplit.getRangeChunks).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dynamic maxLines for logs requests', () => {
    const request = getQueryOptions<LokiQuery>({
      targets: [{ expr: '{a="b"}', refId: 'A', maxLines: 4 }],
      range,
    });
    const { logFrameA } = getMockFrames();
    beforeEach(() => {
      jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [logFrameA], refId: 'A' }));
    });
    test('Stops requesting once maxLines of logs have been received', async () => {
      await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 2 responses of 2 logs, 2 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });
    test('Performs all the requests if maxLines has not been reached', async () => {
      request.targets[0].maxLines = 9999;
      await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3 responses of 2 logs, 3 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
    test('Performs all the requests if not a log query', async () => {
      request.targets[0].maxLines = 1;
      request.targets[0].expr = 'count_over_time({a="b"}[1m])';
      await expect(runPartitionedQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3 responses of 2 logs, 3 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
  });
});
