import {
  DataSourceApi,
  dateTime,
  ExploreUrlState,
  GrafanaConfig,
  locationUtil,
  LogsSortOrder,
  serializeStateToUrlParam,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { RefreshPicker } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DEFAULT_RANGE } from 'app/features/explore/state/constants';
import { getVariablesUrlParams } from 'app/features/variables/getAllVariableValuesForUrl';

import { DatasourceSrvMock, MockDataSourceApi } from '../../../test/mocks/datasource_srv';

import {
  buildQueryTransaction,
  hasNonEmptyQuery,
  refreshIntervalToSortOrder,
  getExploreUrl,
  GetExploreUrlArguments,
  getTimeRange,
  generateEmptyQuery,
} from './explore';

const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  datasource: '',
  queries: [],
  range: DEFAULT_RANGE,
};

const defaultDs = new MockDataSourceApi('default datasource', { data: ['default data'] });
const interpolateMockLoki = jest
  .fn()
  .mockReturnValue([{ refId: 'a', expr: 'replaced testDs loki' }]) as unknown as DataQuery[];
const interpolateMockProm = jest
  .fn()
  .mockReturnValue([{ refId: 'a', expr: 'replaced testDs2 prom' }]) as unknown as DataQuery[];
const datasourceSrv = new DatasourceSrvMock(defaultDs, {
  'generate empty query': new MockDataSourceApi('generateEmptyQuery'),
  ds1: {
    name: 'testDs',
    type: 'loki',
    meta: { mixed: false },
    interpolateVariablesInQueries: interpolateMockLoki,
    getRef: () => {
      return 'ds1';
    },
  } as unknown as DataSourceApi,
  ds2: {
    name: 'testDs2',
    type: 'prom',
    meta: { mixed: false },
    interpolateVariablesInQueries: interpolateMockProm,
    getRef: () => {
      return 'ds2';
    },
  } as unknown as DataSourceApi,
  dsMixed: {
    name: 'testDSMixed',
    type: 'mixed',
    meta: { mixed: true },
  } as MockDataSourceApi,
});

const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

// Avoids errors caused by circular dependencies
jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('state functions', () => {
  describe('serializeStateToUrlParam', () => {
    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasource: 'foo',
        queries: [
          {
            expr: 'metric{test="a/b"}',
            refId: 'A',
          },
          {
            expr: 'super{foo="x/z"}',
            refId: 'B',
          },
        ],
        range: {
          from: 'now-5h',
          to: 'now',
        },
      };

      expect(serializeStateToUrlParam(state)).toBe(
        '{"datasource":"foo","queries":[{"expr":"metric{test=\\"a/b\\"}","refId":"A"},' +
          '{"expr":"super{foo=\\"x/z\\"}","refId":"B"}],"range":{"from":"now-5h","to":"now"}}'
      );
    });
  });
});

describe('getExploreUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const args = {
    queries: [
      { refId: 'A', expr: 'query1', legendFormat: 'legendFormat1' },
      { refId: 'B', expr: 'query2', datasource: { type: '__expr__', uid: '__expr__' } },
    ],
    dsRef: {
      uid: 'ds1',
    },
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
  } as unknown as GetExploreUrlArguments;
  it('should use raw range in explore url', async () => {
    expect(await getExploreUrl(args)).toMatch(/from%22:%22now-1h%22,%22to%22:%22now/g);
  });
  it('should omit expression target in explore url', async () => {
    expect(await getExploreUrl(args)).not.toMatch(/__expr__/g);
  });
  it('should interpolate queries with variables in a non-mixed datasource scenario', async () => {
    // this is not actually valid (see root and query DS being different) but it will test the root DS mock was called
    const nonMixedArgs = {
      queries: [{ refId: 'A', expr: 'query1', datasource: { type: 'prom', uid: 'ds2' } }],
      dsRef: {
        uid: 'ds1',
        meta: { mixed: false },
      },
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      scopedVars: {},
    };
    expect(await getExploreUrl(nonMixedArgs)).toMatch(/replaced%20testDs2%20prom/g);
    expect(interpolateMockLoki).not.toBeCalled();
    expect(interpolateMockProm).toBeCalled();
  });
  it('should interpolate queries with variables in a mixed datasource scenario', async () => {
    const nonMixedArgs = {
      queries: [
        { refId: 'A', expr: 'query1', datasource: { type: 'loki', uid: 'ds1' } },
        { refId: 'B', expr: 'query2', datasource: { type: 'prom', uid: 'ds2' } },
      ],
      dsRef: {
        uid: 'dsMixed',
        meta: { mixed: true },
      },
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      scopedVars: {},
    };
    const url = await getExploreUrl(nonMixedArgs);
    expect(url).toMatch(/replaced%20testDs%20loki/g);
    expect(url).toMatch(/replaced%20testDs2%20prom/g);
    expect(interpolateMockLoki).toBeCalled();
    expect(interpolateMockProm).toBeCalled();
  });

  describe('subpath', () => {
    beforeAll(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/subpath' } as GrafanaConfig,
        getVariablesUrlParams: jest.fn(),
        getTimeRangeForUrl: jest.fn(),
      });
    });
    afterAll(() => {
      // Reset locationUtil
      locationUtil.initialize({
        config,
        getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
        getVariablesUrlParams: getVariablesUrlParams,
      });
    });
    it('should work with sub path', async () => {
      expect(await getExploreUrl(args)).toMatch(/subpath\/explore/g);
    });
  });
});

describe('hasNonEmptyQuery', () => {
  test('should return true if one query is non-empty', () => {
    expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'explore', expr: 'foo' }])).toBeTruthy();
  });

  test('should return false if query is empty', () => {
    expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'panel', datasource: { uid: 'some-ds' } }])).toBeFalsy();
  });

  test('should return false if no queries exist', () => {
    expect(hasNonEmptyQuery([])).toBeFalsy();
  });
});

describe('getTimeRange', () => {
  describe('should not flip from and to when from is after to', () => {
    const rawRange = {
      from: 'now',
      to: 'now-6h',
    };

    const range = getTimeRange('utc', rawRange, 0);

    expect(range.from.isBefore(range.to)).toBe(false);
  });
});

describe('refreshIntervalToSortOrder', () => {
  describe('when called with live option', () => {
    it('then it should return ascending', () => {
      const result = refreshIntervalToSortOrder(RefreshPicker.liveOption.value);

      expect(result).toBe(LogsSortOrder.Ascending);
    });
  });

  describe('when called with off option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(RefreshPicker.offOption.value);

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });

  describe('when called with 5s option', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder('5s');

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });

  describe('when called with undefined', () => {
    it('then it should return descending', () => {
      const result = refreshIntervalToSortOrder(undefined);

      expect(result).toBe(LogsSortOrder.Descending);
    });
  });
});

describe('when buildQueryTransaction', () => {
  it('it should calculate interval based on time range', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
    const from = dateTime('2023-01-01T12:00:00Z');
    const to = dateTime('2023-01-02T12:00:00Z');
    const range = { from, to, raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(60000);
  });
  it('it should calculate interval taking minInterval into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
    const from = dateTime('2023-01-01T12:00:00Z');
    const to = dateTime('2023-01-01T12:01:00Z');
    const range = { from, to, raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.intervalMs).toEqual(15000);
  });
  it('it should calculate interval taking maxDataPoints into account', () => {
    const queries = [{ refId: 'A' }];
    const queryOptions = { maxDataPoints: 10, minInterval: '15s' };
    const from = dateTime('2023-01-01T12:00:00Z');
    const to = dateTime('2023-01-02T12:00:00Z');
    const range = { from, to, raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, queryOptions, range, false);
    expect(transaction.request.interval).toEqual('2h');
  });
  it('it should create a request with X-Cache-Skip set to true', () => {
    const queries = [{ refId: 'A' }];
    const from = dateTime('2023-01-01T12:00:00Z');
    const to = dateTime('2023-01-02T12:00:00Z');
    const range = { from, to, raw: { from: '1h', to: '1h' } };
    const transaction = buildQueryTransaction('left', queries, {}, range, false);
    expect(transaction.request.skipQueryCache).toBe(true);
  });
});

describe('generateEmptyQuery', () => {
  it('should generate query with dataSourceOverride and without queries', async () => {
    const query = await generateEmptyQuery([], 1, { type: 'loki', uid: 'ds1' });

    expect(query.datasource?.uid).toBe('ds1');
    expect(query.datasource?.type).toBe('loki');
    expect(query.refId).toBe('A');
  });
  it('should generate query without dataSourceOverride and with queries', async () => {
    const query = await generateEmptyQuery(
      [
        {
          datasource: { type: 'loki', uid: 'ds1' },
          refId: 'A',
        },
      ],
      1
    );

    expect(query.datasource?.uid).toBe('ds1');
    expect(query.datasource?.type).toBe('loki');
    expect(query.refId).toBe('B');
  });

  it('should generate a query with a unique refId', async () => {
    const query = await generateEmptyQuery([{ refId: 'A' }], 2);

    expect(query.refId).not.toBe('A');
  });
});
