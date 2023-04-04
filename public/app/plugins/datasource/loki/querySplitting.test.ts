import { of } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import { dateTime } from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { LokiDatasource } from './datasource';
import * as logsTimeSplit from './logsTimeSplitting';
import * as metricTimeSplit from './metricTimeSplitting';
import { createLokiDatasource, getMockFrames } from './mocks';
import { runSplitQuery } from './querySplitting';
import { LokiQuery, LokiQueryType } from './types';

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

  test('Handles and reports rerrors', async () => {
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValue(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
    await expect(runSplitQuery(datasource, request)).toEmitValuesWith((values) => {
      expect(values).toEqual([{ error: { refId: 'A', message: 'Error' }, data: [], state: LoadingState.Streaming }]);
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
    });
    afterAll(() => {
      jest.mocked(logsTimeSplit.splitTimeRange).mockRestore();
      jest.mocked(metricTimeSplit.splitTimeRange).mockRestore();
    });
    test('Ignores hidden queries', async () => {
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        expect(logsTimeSplit.splitTimeRange).toHaveBeenCalled();
        expect(metricTimeSplit.splitTimeRange).not.toHaveBeenCalled();
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
    test('Groups multiple queries into logs, queries, and instant', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', queryType: LokiQueryType.Instant },
          { expr: '{c="d"}', refId: 'B' },
          { expr: 'count_over_time({c="d"}[1m])', refId: 'C' },
        ],
        range,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 days, 3 chunks, 3x Logs + 3x Metric + 1x Instant, 7 requests.
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
    test('Groups metric queries by resolution', async () => {
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
    test('Groups mixed queries by resolution', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', resolution: 3 },
          { expr: '{a="b"}', refId: 'B', resolution: 5 },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'C', resolution: 3 },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'D', resolution: 5 },
          { expr: '{a="b"}', refId: 'E', resolution: 5, queryType: LokiQueryType.Instant },
        ],
        range: range1d,
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // A, B, C, D, E
        expect(datasource.runQuery).toHaveBeenCalledTimes(5);
      });
    });
    test('Chunked groups mixed queries by resolution', async () => {
      const request = getQueryOptions<LokiQuery>({
        targets: [
          { expr: '{a="b"}', refId: 'A', resolution: 3 },
          { expr: '{a="b"}', refId: 'B', resolution: 5 },
          { expr: 'count_over_time({a="b"}[1m])', refId: 'C', resolution: 3 },
          { expr: 'count_over_time{a="b"}[1m])', refId: 'D', resolution: 5 },
          { expr: '{a="b"}', refId: 'E', resolution: 5, queryType: LokiQueryType.Instant },
        ],
        range, // 3 days
      });
      await expect(runSplitQuery(datasource, request)).toEmitValuesWith(() => {
        // 3 * A, 3 * B, 3 * C, 3 * D, 1 * E
        expect(datasource.runQuery).toHaveBeenCalledTimes(13);
      });
    });
  });
});
