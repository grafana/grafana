import {
  type AdHocVariableFilter,
  DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  dateTime,
  type ExploreUrlState,
  type GrafanaConfig,
  locationUtil,
  LogsSortOrder,
  type ScopedVars,
  serializeStateToUrlParam,
} from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv, type DataSourceSrv, type TemplateSrv } from '@grafana/runtime';
import { initDataSourceInstanceSettings, setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';
import { RefreshPicker } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DEFAULT_RANGE } from 'app/features/explore/state/constants';
import { getVariablesUrlParams } from 'app/features/variables/getAllVariableValuesForUrl';

import {
  buildQueryTransaction,
  hasNonEmptyQuery,
  refreshIntervalToSortOrder,
  getExploreUrl,
  type GetExploreUrlArguments,
  getTimeRange,
  generateEmptyQuery,
} from './explore';

const DEFAULT_EXPLORE_STATE: ExploreUrlState = {
  datasource: '',
  queries: [],
  range: DEFAULT_RANGE,
};

// The migration under test swaps getDataSourceSrv().get() for getDataSourceInstance() from
// @grafana/runtime/unstable. We deliberately seed the *real* new-API caches (instance settings +
// plugin importer) rather than delegate getDataSourceInstance back to a legacy mock. A
// delegate-to-legacy mock reasserts the old semantics by construction, so it can never fail on the
// template-variable identity gap that got the original migration (#127578) reverted (#127870).
const interpolateMockLoki = jest.fn().mockReturnValue([{ refId: 'a', expr: 'replaced testDs loki' }]);
const interpolateMockProm = jest.fn().mockReturnValue([{ refId: 'a', expr: 'replaced testDs2 prom' }]);
const interpolateByUid: Record<string, jest.Mock> = { ds1: interpolateMockLoki, ds2: interpolateMockProm };

function makeSettings(
  uid: string,
  name: string,
  type: string,
  opts: { isDefault?: boolean; mixed?: boolean } = {}
): DataSourceInstanceSettings {
  return {
    id: 1,
    uid,
    name,
    type,
    access: 'direct',
    jsonData: {},
    readOnly: false,
    isDefault: opts.isDefault ?? false,
    meta: {
      id: type,
      name: type,
      type: 'datasource',
      module: '',
      baseUrl: '',
      mixed: opts.mixed ?? false,
      metrics: true,
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { small: '', large: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
    } as unknown as DataSourcePluginMeta,
  } as DataSourceInstanceSettings;
}

const DEFAULT_DS_NAME = 'default datasource';
const dsSettings: Record<string, DataSourceInstanceSettings> = {
  default: makeSettings('default-uid', DEFAULT_DS_NAME, 'test-db', { isDefault: true }),
  ds1: makeSettings('ds1', 'testDs', 'loki'),
  ds2: makeSettings('ds2', 'testDs2', 'prom'),
  dsMixed: makeSettings('dsMixed', 'testDSMixed', 'mixed', { mixed: true }),
};

// Unlike a preset-instance mock, this class derives its identity from the settings the loader
// passes to its constructor — the identity a real plugin instance carries. A variable ref that
// resolves to a concrete uid therefore yields an instance whose getRef()/uid is the concrete uid,
// never the literal "${var}".
class TestDataSource extends DataSourceApi<DataQuery> {
  query() {
    return Promise.resolve({ data: [] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
  interpolateVariablesInQueries(queries: DataQuery[], scopedVars: ScopedVars, filters?: AdHocVariableFilter[]) {
    const spy = interpolateByUid[this.uid];
    return spy ? spy(queries, scopedVars, filters) : queries;
  }
}

const pluginImporter = jest.fn().mockResolvedValue({ DataSourceClass: TestDataSource, components: {} });

beforeEach(() => {
  initDataSourceInstanceSettings(dsSettings, DEFAULT_DS_NAME);
  setDataSourcePluginImporter(pluginImporter);
  // Resolve the datasource template variable to a concrete uid, mirroring dashboard interpolation.
  setTemplateSrv({
    getVariables: () => [],
    replace: (target?: string) => (target === '${datasource}' ? 'ds1' : (target ?? '')),
  } as unknown as TemplateSrv);
  // No legacy srv: the new-API fallback stays inert, so a resolution miss surfaces as a failure
  // instead of silently delegating to legacy semantics (the shape that hid the reverted bug).
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
});

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
        config: window.grafanaBootData.settings,
        getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
        getVariablesUrlParams: getVariablesUrlParams,
      });
    });
    it('should work with sub path', async () => {
      expect(await getExploreUrl(args)).toMatch(/subpath\/explore/g);
    });
  });
});

describe('getExploreUrl datasource identity (DPRO-168 regression)', () => {
  const timeRange = { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } };

  // Reads the query datasource that getExploreUrl actually wrote into the URL. This is the field
  // Explore consumes — the reverted migration wrote the literal "${datasource}" here, so Explore
  // could not map it and fell back to the default datasource with an empty query.
  function queryDatasourceFromUrl(url: string): unknown {
    const panes = JSON.parse(new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('panes')!);
    const [pane] = Object.values(panes) as Array<{ queries: DataQuery[] }>;
    return pane.queries[0].datasource;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a concrete uid ref to that datasource', async () => {
    const url = await getExploreUrl({
      queries: [{ refId: 'A', expr: 'query1', datasource: { type: 'prom', uid: 'ds2' } }],
      dsRef: { type: 'loki', uid: 'ds1' },
      timeRange,
      scopedVars: {},
    } as unknown as GetExploreUrlArguments);

    expect(queryDatasourceFromUrl(url!)).toEqual({ type: 'prom', uid: 'ds2' });
  });

  it('resolves to the default datasource when no ref is provided', async () => {
    const url = await getExploreUrl({
      queries: [{ refId: 'A', expr: 'query1' }],
      dsRef: null,
      timeRange,
      scopedVars: {},
    } as unknown as GetExploreUrlArguments);

    expect(queryDatasourceFromUrl(url!)).toEqual({ type: 'test-db', uid: 'default-uid' });
  });

  it('carries the concrete resolved uid when the panel datasource is a ${var} ref object (v2 panel shape)', async () => {
    const url = await getExploreUrl({
      queries: [{ refId: 'A', expr: 'query1' }],
      dsRef: { uid: '${datasource}', type: '' },
      timeRange,
      scopedVars: {},
    } as unknown as GetExploreUrlArguments);

    // Concrete uid, not the literal variable. On the old identity gap getRef() returned
    // { type: 'loki', uid: '${datasource}' } and this assertion fails.
    expect(queryDatasourceFromUrl(url!)).toEqual({ type: 'loki', uid: 'ds1' });
  });

  it('carries the concrete resolved uid when a query datasource is a ${var} ref object', async () => {
    const url = await getExploreUrl({
      queries: [{ refId: 'A', expr: 'query1', datasource: { uid: '${datasource}', type: '' } }],
      dsRef: { type: 'prom', uid: 'ds2' },
      timeRange,
      scopedVars: {},
    } as unknown as GetExploreUrlArguments);

    expect(queryDatasourceFromUrl(url!)).toEqual({ type: 'loki', uid: 'ds1' });
  });

  it('carries the concrete resolved uid when a query datasource is a ${var} string', async () => {
    const url = await getExploreUrl({
      queries: [{ refId: 'A', expr: 'query1', datasource: '${datasource}' }],
      dsRef: { type: 'prom', uid: 'ds2' },
      timeRange,
      scopedVars: {},
    } as unknown as GetExploreUrlArguments);

    expect(queryDatasourceFromUrl(url!)).toEqual({ type: 'loki', uid: 'ds1' });
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
