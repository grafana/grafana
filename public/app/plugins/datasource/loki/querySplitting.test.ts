import { of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { dateTime } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import * as logsTimeSplit from './logsTimeSplitting';
import * as metricTimeSplit from './metricTimeSplitting';
import { createLokiDatasource, getMockFrames } from './mocks';
import { runSplitQuery } from './querySplitting';
import { trackGroupedQueries } from './tracking';
import { LokiQuery, LokiQueryType } from './types';

jest.mock('./tracking');

describe('runSplitQuery()', () => {
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
    await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 3 days, 3 chunks, 3 requests.
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });

  test('Correctly splits queries without step', async () => {
    await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          requestId: 'TEST_3',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              //2023-02-09T06:00:00.000Z
              _i: 1675922400000,
            }),
            to: expect.objectContaining({
              // 2023-02-10T06:00:00.000Z
              _i: 1676008800000,
            }),
          }),
        })
      );

      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          requestId: 'TEST_2',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              //2023-02-08T05:59:00.000Z
              _i: 1675835940000,
            }),
            to: expect.objectContaining({
              // 2023-02-09T05:59:00.000Z
              _i: 1675922340000,
            }),
          }),
        })
      );

      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          requestId: 'TEST_1',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              //2023-02-08T05:00:00.000Z
              _i: 1675832400000,
            }),
            to: expect.objectContaining({
              // 2023-02-08T05:58:00.000Z
              _i: 1675835880000,
            }),
          }),
        })
      );
    });
  });

  test('Correctly splits queries with step', async () => {
    const req = { ...request };
    req.targets[0].step = '10s';
    await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          requestId: 'TEST_3',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              //2023-02-09T06:00:00.000Z
              _i: 1675922400000,
            }),
            to: expect.objectContaining({
              // 2023-02-10T06:00:00.000Z
              _i: 1676008800000,
            }),
          }),
        })
      );

      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          requestId: 'TEST_2',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              //2023-02-08T05:59:50.000Z
              _i: 1675835990000,
            }),
            to: expect.objectContaining({
              // 2023-02-09T05:59:50.000Z
              _i: 1675922390000,
            }),
          }),
        })
      );

      expect(datasource.runQuery).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          requestId: 'TEST_1',
          intervalMs: 60000,
          range: expect.objectContaining({
            from: expect.objectContaining({
              // 2023-02-08T05:00:00.000Z
              _i: 1675832400000,
            }),
            to: expect.objectContaining({
              // 2023-02-08T05:59:40.000Z
              _i: 1675835980000,
            }),
          }),
        })
      );
    });
  });

  test('Handles and reports errors', async () => {
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValue(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
    await expect(runSplitQuery(datasource, request)).toEmitValuesWith((values) => {
      expect(values).toHaveLength(1);
      expect(values[0]).toEqual(
        expect.objectContaining({ error: { refId: 'A', message: 'Error' }, state: LoadingState.Streaming })
      );
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
      jest.spyOn(logsTimeSplit, 'splitTimeRange').mockReturnValue([]);
      jest.spyOn(metricTimeSplit, 'splitTimeRange').mockReturnValue([]);
      jest.mocked(trackGroupedQueries).mockClear();
      jest.useFakeTimers().setSystemTime(new Date('Wed May 17 2023 17:20:12 GMT+0200'));
    });
    afterAll(() => {
      jest.mocked(logsTimeSplit.splitTimeRange).mockRestore();
      jest.mocked(metricTimeSplit.splitTimeRange).mockRestore();
      jest.useRealTimers();
    });
    test('Ignores hidden queries', async () => {
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        expect(logsTimeSplit.splitTimeRange).toHaveBeenCalled();
        expect(metricTimeSplit.splitTimeRange).not.toHaveBeenCalled();
        expect(trackGroupedQueries).toHaveBeenCalledTimes(1);
        expect(trackGroupedQueries).toHaveBeenCalledWith(
          {
            data: [],
            state: LoadingState.Done,
          },
          [
            {
              partition: [],
              request: {
                ...request,
                targets: request.targets.filter((query) => !query.hide),
              },
            },
          ],
          request,
          new Date(),
          { predefinedOperations: '' }
        );
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
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 2 responses of 2 logs, 2 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });
    test('Performs all the requests if maxLines has not been reached', async () => {
      request.targets[0].maxLines = 9999;
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3 responses of 2 logs, 3 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
    test('Performs all the requests if not a log query', async () => {
      request.targets[0].maxLines = 1;
      request.targets[0].expr = 'count_over_time({a="b"}[1m])';
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3 responses of 2 logs, 3 requests
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Splitting multiple targets', () => {
    beforeEach(() => {
      jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [], refId: 'A' }));
    });
    test('Sends logs and metric queries individually', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A' },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'B' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 1x Metric + 1x Log, 6 requests.
        expect(datasource.runQuery).toHaveBeenCalledTimes(6);
      });
    });
    test('Groups metric queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A' },
          { expr: 'count_over_time({c="d"}[1m])', refId: 'B' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 1x2 Metric, 3 requests.
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
    test('Groups logs queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A' },
          { expr: '{c="d"}', refId: 'B' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 1x2 Logs, 3 requests.
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
    test('Groups instant queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', queryType: LokiQueryType.Instant },
          { expr: 'count_over_time({c="d"}[1m])', refId: 'B', queryType: LokiQueryType.Instant },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // Instant queries are omitted from splitting
        expect(datasource.runQuery).toHaveBeenCalledTimes(1);
      });
    });
    test('Groups queries using distinct', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"} | distinct field', refId: 'A' },
          { expr: 'count_over_time({c="d"} | distinct something [1m])', refId: 'B' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // Queries using distinct are omitted from splitting
        expect(datasource.runQuery).toHaveBeenCalledTimes(1);
      });
    });
    test('Respects maxLines of logs queries', async () => {
      const { logFrameA } = getMockFrames();
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', maxLines: logFrameA.fields[0].values.length },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'B' },
        ],
        range,
      });
      jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [], refId: 'B' }));
      jest.spyOn(datasource, 'runQuery').mockReturnValueOnce(of({ data: [logFrameA], refId: 'A' }));

      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 1x Logs + 3x Metric, 3 requests.
        expect(datasource.runQuery).toHaveBeenCalledTimes(4);
      });
    });
    test('Groups multiple queries into logs, queries, instant, and distinct', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', queryType: LokiQueryType.Instant },
          { expr: '{c="d"}', refId: 'B' },
          { expr: 'count_over_time({c="d"}[1m])', refId: 'C' },
          { expr: 'count_over_time({c="d"} | distinct id [1m])', refId: 'D' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3x Logs + 3x Metric + (1x Instant | Distinct), 7 requests.
        expect(datasource.runQuery).toHaveBeenCalledTimes(7);
      });
    });
  });

  describe('Splitting targets based on splitDuration', () => {
    const range1h = {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-08T06:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T05:00:00.000Z'),
        to: dateTime('2023-02-08T06:00:00.000Z'),
      },
    };
    beforeEach(() => {
      jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [], refId: 'A' }));
    });
    test('with 30m splitDuration runs 2 queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{a="b"}', refId: 'A', splitDuration: '30m' }],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });
    test('with 1h splitDuration runs 1 queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{a="b"}', refId: 'A', splitDuration: '1h' }],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        expect(datasource.runQuery).toHaveBeenCalledTimes(1);
      });
    });
    test('with 1h splitDuration and 2 targets runs 1 queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', splitDuration: '1h' },
          { expr: '{a="b"}', refId: 'B', splitDuration: '1h' },
        ],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        expect(datasource.runQuery).toHaveBeenCalledTimes(1);
      });
    });
    test('with 1h/30m splitDuration and 2 targets runs 3 queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', splitDuration: '1h' },
          { expr: '{a="b"}', refId: 'B', splitDuration: '30m' },
        ],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 2 x 30m + 1 x 1h
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
    test('with mixed splitDuration runs the expected amount of queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({c="d"}[1m])', refId: 'A', splitDuration: '15m' },
          { expr: '{a="b"}', refId: 'B', splitDuration: '15m' },
          { expr: '{a="b"}', refId: 'C', splitDuration: '1h' },
        ],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 4 * 15m + 4 * 15m + 1 * 1h
        expect(datasource.runQuery).toHaveBeenCalledTimes(9);
      });
    });
    test('with 1h/30m splitDuration and 1 log and 2 metric target runs 3 queries', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', splitDuration: '1h' },
          { expr: 'count_over_time({c="d"}[1m])', refId: 'C', splitDuration: '30m' },
        ],
        range: range1h,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 2 x 30m + 1 x 1h
        expect(datasource.runQuery).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Splitting targets based on resolution', () => {
    const range1d = {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-09T05:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T05:00:00.000Z'),
        to: dateTime('2023-02-09T05:00:00.000Z'),
      },
    };
    test('Groups logs queries by resolution', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', resolution: 3 },
          { expr: '{a="b"}', refId: 'B', resolution: 5 },
        ],
        range: range1d,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // A, B
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });
    test('Groups metric queries with no step by calculated stepMs', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', resolution: 3 },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'B', resolution: 5 },
        ],
        range: range1d,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // A, B
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });

    test('Groups metric queries with step by stepMs', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', resolution: 1, step: '10' },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'B', resolution: 1, step: '5ms' },
        ],
        range: range1d,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // A, B
        expect(datasource.runQuery).toHaveBeenCalledTimes(2);
      });
    });
    test('Groups mixed queries by stepMs', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', resolution: 3 },
          { expr: '{a="b"}', refId: 'B', resolution: 5 },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'C', resolution: 3 },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'D', resolution: 5 },
          { expr: '{a="b"}', refId: 'E', resolution: 5, queryType: LokiQueryType.Instant },
          { expr: 'rate({a="b"}[5m])', refId: 'F', resolution: 5, step: '10' },
          { expr: 'rate({a="b"} | logfmt[5m])', refId: 'G', resolution: 5, step: '10s' },
        ],
        range: range1d,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // A, B, C, D, E, F+G
        expect(datasource.runQuery).toHaveBeenCalledTimes(6);
      });
    });
    test('Chunked groups mixed queries by stepMs', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', resolution: 3 },
          { expr: '{a="b"}', refId: 'B', resolution: 5 },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'C', resolution: 3 },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'D', resolution: 5 },
          { expr: '{a="b"}', refId: 'E', resolution: 5, queryType: LokiQueryType.Instant },
          { expr: 'rate({a="b"}[5m])', refId: 'F', resolution: 5, step: '10' },
          { expr: 'rate({a="b"} | logfmt[5m])', refId: 'G', resolution: 5, step: '10s' },
        ],
        range, // 3 days
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 * A, 3 * B, 3 * C, 3 * D, 1 * E, 3 * F+G
        expect(datasource.runQuery).toHaveBeenCalledTimes(16);
      });
    });
  });
});
