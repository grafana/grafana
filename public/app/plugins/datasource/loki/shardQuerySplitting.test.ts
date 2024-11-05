import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, LoadingState } from '@grafana/data';

import { createLokiDatasource } from './__mocks__/datasource';
import { getMockFrames } from './__mocks__/frames';
import { LokiDatasource } from './datasource';
import { runShardSplitQuery } from './shardQuerySplitting';
import { LokiQuery, LokiQueryDirection } from './types';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid'),
}));

const originalLog = console.log;
const originalWarn = console.warn;
beforeEach(() => {
  //jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  console.log = originalLog;
  console.warn = originalWarn;
});

describe('runShardSplitQuery()', () => {
  let datasource: LokiDatasource;
  const range = {
    from: dateTime('2023-02-08T04:00:00.000Z'),
    to: dateTime('2023-02-08T11:00:00.000Z'),
    raw: {
      from: dateTime('2023-02-08T04:00:00.000Z'),
      to: dateTime('2023-02-08T11:00:00.000Z'),
    },
  };

  const createRequest = (targets: Array<Partial<LokiQuery>>, overrides?: Partial<DataQueryRequest<LokiQuery>>) => {
    let request = {
      range,
      targets,
      intervalMs: 60000,
      requestId: 'TEST',
    } as DataQueryRequest<LokiQuery>;

    Object.assign(request, overrides);
    return request;
  };
  let request: DataQueryRequest<LokiQuery>;
  beforeEach(() => {
    request = createRequest([
      { expr: 'count_over_time($SELECTOR[1m])', refId: 'A', direction: LokiQueryDirection.Scan },
    ]);
    datasource = createLokiDatasource();
    datasource.languageProvider.fetchLabelValues = jest.fn();
    datasource.interpolateVariablesInQueries = jest.fn().mockImplementation((queries: LokiQuery[]) => {
      return queries.map((query) => {
        query.expr = query.expr.replace('$SELECTOR', '{a="b"}');
        return query;
      });
    });
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1', '10', '2', '20', '3']);
    const { metricFrameA } = getMockFrames();
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [metricFrameA] }));
    jest.spyOn(datasource, 'query').mockReturnValue(of({ data: [metricFrameA] }));
  });

  test('Splits datasource queries', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
    });
  });

  test('Interpolates queries before running', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_0_2',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"20|10"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_2_2',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"3|2"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_4_1',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__="1"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_5_1',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=""} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });
    });
  });

  test('Sends the whole stream selector to fetch values', async () => {
    datasource.interpolateVariablesInQueries = jest.fn().mockImplementation((queries: LokiQuery[]) => {
      return queries.map((query) => {
        query.expr = query.expr.replace('$SELECTOR', '{service_name="test", filter="true"}');
        return query;
      });
    });

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.languageProvider.fetchLabelValues).toHaveBeenCalledWith('__stream_shard__', {
        streamSelector: '{service_name="test", filter="true"}',
        timeRange: expect.anything(),
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_0_2',
        targets: [
          {
            expr: 'count_over_time({service_name="test", filter="true", __stream_shard__=~"20|10"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });
    });
  });

  test('Returns a DataQueryResponse with the expected attributes', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      expect(response[0].data).toBeDefined();
      expect(response[0].state).toBe(LoadingState.Done);
      expect(response[0].key).toBeDefined();
    });
  });

  test('Retries failed retriable requests', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1']);
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, errors: [{ refId: 'A', message: 'timeout' }], data: [] }));
    // @ts-expect-error
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback) => {
      callback();
    });
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 1 shard + empty shard + 1 retry = 3
      expect(response).toHaveLength(3);
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });

  test('Does not retry on other errors', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1']);
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, errors: [{ refId: 'A', message: 'nope nope' }], data: [] }));
    // @ts-expect-error
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback) => {
      callback();
    });
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      expect(datasource.runQuery).toHaveBeenCalledTimes(2);
    });
  });

  test('Adjusts the group size based on errors and execution time', async () => {
    const request = createRequest(
      [{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A', direction: LokiQueryDirection.Scan }],
      {
        range: {
          from: dateTime('2024-11-13T05:00:00.000Z'),
          to: dateTime('2024-11-14T06:00:00.000Z'),
          raw: {
            from: dateTime('2024-11-13T05:00:00.000Z'),
            to: dateTime('2024-11-14T06:00:00.000Z'),
          },
        },
      }
    );

    jest
      .mocked(datasource.languageProvider.fetchLabelValues)
      .mockResolvedValue(['1', '10', '2', '20', '3', '4', '5', '6', '7', '8', '9']);

    // @ts-expect-error
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback) => {
      callback();
    });

    const { metricFrameA } = getMockFrames();

    jest.mocked(datasource.runQuery).mockReset();

    // + 50%
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.5,
                },
              ],
            },
          },
        ],
      })
    );

    // sqrt(currentSize)
    jest
      .mocked(datasource.runQuery)
      .mockReturnValueOnce(of({ state: LoadingState.Error, errors: [{ refId: 'A', message: 'timeout' }], data: [] }));

    // +10%
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 5,
                },
              ],
            },
          },
        ],
      })
    );

    // -10%
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 15,
                },
              ],
            },
          },
        ],
      })
    );

    // -10%
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 19,
                },
              ],
            },
          },
        ],
      })
    );

    // -50%
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 21,
                },
              ],
            },
          },
        ],
      })
    );

    // No more than 50% of the remaining shards
    jest.mocked(datasource.runQuery).mockReturnValue(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.5,
                },
              ],
            },
          },
        ],
      })
    );

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_0_3',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"20|10|9"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // +50%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_3_4',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"8|7|6|5"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // Error, sqrt(currentSize)
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_3_2',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"8|7"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // +10%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_5_3',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"6|5|4"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // -10%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_8_2',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=~"3|2"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // No more than 50% of the remaining shards
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_10_1',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__="1"} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // No more than 50% of the remaining shards
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_11_1',
        targets: [
          {
            expr: 'count_over_time({a="b", __stream_shard__=""} | drop __stream_shard__[1m])',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });
    });
  });
});
