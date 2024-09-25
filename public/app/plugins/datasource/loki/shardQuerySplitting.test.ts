import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, LoadingState } from '@grafana/data';

import { createLokiDatasource } from './__mocks__/datasource';
import { getMockFrames } from './__mocks__/frames';
import { LokiDatasource } from './datasource';
import { runShardSplitQuery } from './shardQuerySplitting';
import { LokiQuery } from './types';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid'),
}));

const originalLog = console.log;
const originalWarn = console.warn;
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
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
    request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }]);
    datasource = createLokiDatasource();
    jest.spyOn(datasource.languageProvider, 'fetchLabelValues').mockResolvedValue(['1', '10', '2', '20', '3']);
    jest.spyOn(datasource, 'interpolateVariablesInQueries').mockImplementation((queries: LokiQuery[]) => {
      return queries.map((query) => {
        query.expr = query.expr.replace('$SELECTOR', '{a="b"}');
        return query;
      });
    });
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

  test('Does not report missing data while streaming', async () => {
    // @ts-expect-error
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ status: 200 }));
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 4 shard requests
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
      expect(response).toHaveLength(1);
    });
  });

  test('Interpolates queries before running', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);

      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"20|3"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"10|2"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="1"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
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
        requestId: 'TEST_shard_0',
        targets: [
          { expr: 'count_over_time({service_name="test", filter="true", __stream_shard__=~"20|3"}[1m])', refId: 'A' },
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

  test('Retries failed requests', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1']);
    jest
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
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

  test('For time ranges over a day queries shards independently', async () => {
    const request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }], {
      range: {
        from: dateTime('2024-11-13T05:00:00.000Z'),
        to: dateTime('2024-11-14T06:00:00.000Z'),
        raw: {
          from: dateTime('2024-11-13T05:00:00.000Z'),
          to: dateTime('2024-11-14T06:00:00.000Z'),
        },
      },
    });

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="20"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="3"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="10"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="2"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_4',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="1"}[1m])', refId: 'A' }],
      });
      
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_5',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
      });
    });
  });
});
