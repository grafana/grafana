import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, LoadingState } from '@grafana/data';

import { LokiDatasource } from './datasource';
import { createLokiDatasource } from './mocks/datasource';
import { getMockFrames } from './mocks/frames';
import { runShardSplitQuery } from './shardQuerySplitting';
import { LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid'),
}));

const originalLog = console.log;
const originalWarn = console.warn;
const originalErr = console.error;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalErr;
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
    request = createRequest([{ expr: '$SELECTOR', refId: 'A', direction: LokiQueryDirection.Scan }]);
    datasource = createLokiDatasource();
    datasource.languageProvider.fetchLabelValues = jest.fn();
    datasource.applyTemplateVariables = jest.fn().mockImplementation((query: LokiQuery) => {
      query.expr = query.expr.replace('$SELECTOR', '{a="b"}');
      return query;
    });
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1', '10', '2', '20', '3']);
    const { metricFrameA } = getMockFrames();
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [metricFrameA] }));
    jest.spyOn(datasource, 'query').mockReturnValue(of({ data: [metricFrameA] }));
  });

  test('Splits datasource queries', async () => {
    const querySplittingRange = {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-10T06:00:00.000Z'),
      raw: {
        from: dateTime('2023-02-08T05:00:00.000Z'),
        to: dateTime('2023-02-10T06:00:00.000Z'),
      },
    };
    request = createRequest([{ expr: '$SELECTOR', refId: 'A', direction: LokiQueryDirection.Scan }], {
      range: querySplittingRange,
    });
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests * 3 days, 3 chunks, 3 requests = 12 requests
      expect(datasource.runQuery).toHaveBeenCalledTimes(12);
    });
  });

  test('Interpolates queries before execution', async () => {
    const request = createRequest([{ expr: 'count_over_time({a="b"}[$__auto])', refId: 'A', step: '$step' }]);
    datasource = createLokiDatasource({
      replace: (input = '') => {
        return input.replace('$__auto', '5m').replace('$step', '5m');
      },
      getVariables: () => [],
    });
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [] }));
    datasource.languageProvider.fetchLabelValues = jest.fn();
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1', '10', '2', '20', '3']);
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(jest.mocked(datasource.runQuery).mock.calls[0][0].targets[0].expr).toBe(
        'count_over_time({a="b", __stream_shard__=~"20|10"} | drop __stream_shard__[5m])'
      );
      expect(jest.mocked(datasource.runQuery).mock.calls[0][0].targets[0].step).toBe('5m');
    });
  });

  test('Runs multiple non-sharded queries', async () => {
    const request = createRequest([
      { expr: 'count_over_time({a="b"}[$__auto])', refId: 'A' },
      { expr: 'count_over_time({a="b"}[$__auto])', refId: 'B', queryType: LokiQueryType.Instant },
    ]);
    datasource = createLokiDatasource({
      replace: (input = '') => {
        return input.replace('$__auto', '5m').replace('$step', '5m');
      },
      getVariables: () => [],
    });
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [] }));
    datasource.languageProvider.fetchLabelValues = jest.fn();
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue([]);
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      expect(datasource.runQuery).toHaveBeenCalledTimes(2);
    });
  });

  test('Users query splitting for querying over a day', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
    });
  });

  test('Interpolates queries before running', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.applyTemplateVariables).toHaveBeenCalledTimes(5);

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_0_2_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"20|10"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_2_2_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"3|2"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_4_1_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__="1"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_5_1_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=""}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });
    });
  });

  test('Sends the whole stream selector to fetch values', async () => {
    datasource.applyTemplateVariables = jest.fn().mockImplementation((query: LokiQuery) => {
      query.expr = query.expr.replace('$SELECTOR', '{service_name="test", filter="true"}');
      return query;
    });

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.languageProvider.fetchLabelValues).toHaveBeenCalledWith('__stream_shard__', {
        streamSelector: '{service_name="test", filter="true"}',
        timeRange: expect.anything(),
      });

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_0_2_1',
        targets: [
          {
            expr: '{service_name="test", filter="true", __stream_shard__=~"20|10"}',
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

  test('Failed requests have loading state Error', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1']);
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValue(of({ state: LoadingState.Error, error: { refId: 'A', message: 'parse error' }, data: [] }));
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      expect(response[0].state).toBe(LoadingState.Error);
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
      expect(datasource.runQuery).toHaveBeenCalledTimes(1);
    });
  });

  test('Adjusts the group size based on errors and execution time', async () => {
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
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_0_3_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"20|10|9"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // +50%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_3_4_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"8|7|6|5"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // Error, sqrt(currentSize)
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_3_2_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"8|7"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // +10%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_5_3_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"6|5|4"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // -10%
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_8_2_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=~"3|2"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // No more than 50% of the remaining shards
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_10_1_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__="1"}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });

      // No more than 50% of the remaining shards
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        queryGroupId: expect.any(String),
        requestId: 'TEST_shard_0_11_1_1',
        targets: [
          {
            expr: '{a="b", __stream_shard__=""}',
            refId: 'A',
            direction: LokiQueryDirection.Scan,
          },
        ],
      });
    });
  });
});
