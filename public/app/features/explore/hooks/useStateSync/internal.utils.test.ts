import {
  CoreApp,
  DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type ExploreUrlState,
} from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv, type DataSourceSrv, type TemplateSrv } from '@grafana/runtime';
import { initDataSourceInstanceSettings, setDataSourcePluginImporter } from '@grafana/runtime/internal';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { setLastUsedDatasourceUID } from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DEFAULT_RANGE } from '../../state/constants';

import {
  getDefaultQuery,
  getPaneDatasource,
  getQueryFilter,
  isMixedDatasource,
  removeQueriesWithInvalidDatasource,
  urlDiff,
} from './internal.utils';

function makeSettings(
  uid: string,
  name: string,
  type: string,
  opts: { isDefault?: boolean } = {}
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

interface TestQuery extends DataQuery {
  expr?: string;
}

const DEFAULT_DS_NAME = 'default datasource';
const dsSettings: Record<string, DataSourceInstanceSettings> = {
  default: makeSettings('default-uid', DEFAULT_DS_NAME, 'test-db', { isDefault: true }),
  loki: makeSettings('loki-uid', 'loki', 'logs'),
  elastic: makeSettings('elastic-uid', 'elastic', 'elasticsearch'),
  mixed: makeSettings('mixed-uid', MIXED_DATASOURCE_NAME, 'mixed'),
  withDefaultQuery: makeSettings('with-default-query-uid', 'withDefaultQuery', 'with-default-query'),
};

// Deriving identity from the settings the loader passes to the constructor — the identity a real
// plugin instance carries. A `$var` ref that interpolates to a concrete uid must therefore produce
// an instance whose uid/getRef() is the concrete uid, never the literal "${var}".
class TestDataSource extends DataSourceApi<TestQuery> {
  query() {
    return Promise.resolve({ data: [] });
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

// Same, but exposes a plugin-supplied default query so getDefaultQuery has something to merge.
class DefaultQueryDataSource extends TestDataSource {
  getDefaultQuery(app: CoreApp): Partial<TestQuery> {
    return { expr: `default for ${app}` };
  }
}

// Legacy Explore URLs can carry a query's `datasource` as a bare string — by uid, by name, or as a
// template variable. The schema type only allows a DataSourceRef, but getQueryFilter and
// removeQueriesWithInvalidDatasource both handle the string form on purpose, so it needs covering.
const legacyStringDs = (ref: string) => ref as unknown as DataSourceRef;

const ORG_ID = 1;

// The class is chosen from the plugin meta rather than per seed() call: constructed instances stay
// cached for the lifetime of the module, so re-seeding a different class for a uid that an earlier
// test already loaded would have no effect.
function seed({ defaultName = DEFAULT_DS_NAME } = {}) {
  initDataSourceInstanceSettings(dsSettings, defaultName);
  setDataSourcePluginImporter(
    jest.fn().mockImplementation((meta: DataSourcePluginMeta) =>
      Promise.resolve({
        DataSourceClass: meta.id === 'with-default-query' ? DefaultQueryDataSource : TestDataSource,
        components: {},
      })
    )
  );
}

beforeEach(() => {
  window.localStorage.clear();
  seed();
  // Interpolate the datasource variable to a concrete uid, mirroring dashboard interpolation.
  setTemplateSrv({
    getVariables: () => [],
    replace: (target?: string) => (target === '${datasource}' ? 'loki-uid' : (target ?? '')),
  } as unknown as TemplateSrv);
  // No legacy srv: the new-API fallback stays inert, so a resolution miss surfaces as a failure
  // instead of silently delegating to legacy semantics.
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
});

afterAll(() => {
  window.localStorage.clear();
});

describe('urlDiff', () => {
  const urlState = (overrides: Partial<ExploreUrlState> = {}): ExploreUrlState => ({
    datasource: 'loki-uid',
    queries: [{ refId: 'A' }],
    range: { from: 'now-1h', to: 'now' },
    ...overrides,
  });

  it('reports nothing changed for equal states', () => {
    expect(urlDiff(urlState(), urlState())).toEqual({
      datasource: false,
      queries: false,
      range: false,
      panelsState: false,
    });
  });

  it('reports each field that changed', () => {
    expect(urlDiff(urlState(), urlState({ datasource: 'elastic-uid' })).datasource).toBe(true);
    expect(urlDiff(urlState(), urlState({ queries: [{ refId: 'B' }] })).queries).toBe(true);
    expect(urlDiff(urlState(), urlState({ range: { from: 'now-6h', to: 'now' } })).range).toBe(true);
    expect(urlDiff(urlState(), urlState({ panelsState: { trace: { spanId: '1' } } })).panelsState).toBe(true);
  });

  it('treats a missing range as the default range', () => {
    expect(urlDiff(urlState({ range: undefined }), urlState({ range: DEFAULT_RANGE })).range).toBe(false);
  });

  it('reports everything changed when one state is undefined', () => {
    // A range that is deliberately not DEFAULT_RANGE, which the missing old state stands in for.
    const current = urlState({ range: { from: 'now-90d', to: 'now-89d' } });

    expect(urlDiff(undefined, current)).toEqual({
      datasource: true,
      queries: true,
      range: true,
      panelsState: false,
    });
  });
});

describe('getPaneDatasource', () => {
  it('uses the root datasource when it resolves', async () => {
    const result = await getPaneDatasource('elastic-uid', [], ORG_ID);

    expect(result?.uid).toBe('elastic-uid');
  });

  it('resolves the root datasource by name as well as uid', async () => {
    const result = await getPaneDatasource('elastic', [], ORG_ID);

    expect(result?.uid).toBe('elastic-uid');
  });

  it('falls through to the queries when the root datasource is unavailable', async () => {
    const result = await getPaneDatasource('UNKNOWN-UID', [{ refId: 'A', datasource: { uid: 'loki-uid' } }], ORG_ID);

    expect(result?.uid).toBe('loki-uid');
  });

  it('returns the mixed datasource when the queries span multiple valid datasources', async () => {
    const result = await getPaneDatasource(
      null,
      [
        { refId: 'A', datasource: { uid: 'loki-uid' } },
        { refId: 'B', datasource: { uid: 'elastic-uid' } },
      ],
      ORG_ID
    );

    expect(result?.name).toBe(MIXED_DATASOURCE_NAME);
  });

  it("returns the single valid query datasource, ignoring the ones that don't resolve", async () => {
    const result = await getPaneDatasource(
      null,
      [
        { refId: 'A', datasource: { uid: 'loki-uid' } },
        { refId: 'B', datasource: { uid: 'UNKNOWN-UID' } },
      ],
      ORG_ID
    );

    expect(result?.uid).toBe('loki-uid');
  });

  it('falls back to the last used datasource when nothing else is specified', async () => {
    setLastUsedDatasourceUID(ORG_ID, 'elastic-uid');

    const result = await getPaneDatasource(null, [], ORG_ID);

    expect(result?.uid).toBe('elastic-uid');
  });

  it('falls back to the default datasource when the last used one no longer exists', async () => {
    setLastUsedDatasourceUID(ORG_ID, 'removed-uid');

    const result = await getPaneDatasource(null, [], ORG_ID);

    expect(result?.uid).toBe('default-uid');
  });

  it('resolves to undefined when nothing resolves and there is no default datasource', async () => {
    seed({ defaultName: 'no such datasource' });

    const result = await getPaneDatasource(
      'UNKNOWN-UID',
      [{ refId: 'A', datasource: legacyStringDs('ALSO-UNKNOWN') }],
      ORG_ID
    );

    expect(result).toBeUndefined();
  });

  // The parity gap behind the revert of the first migration attempt: Explore's `panes` URL param
  // can carry a `$var`, and the pane instance must come out with the concrete identity.
  describe('template variable refs', () => {
    it('resolves a $var root datasource to the concrete instance', async () => {
      const result = await getPaneDatasource('${datasource}', [], ORG_ID);

      expect(result?.uid).toBe('loki-uid');
      expect(result?.name).toBe('loki');
      expect(result?.getRef()).toEqual({ type: 'logs', uid: 'loki-uid' });
    });

    it('resolves a $var arriving inside a ref object', async () => {
      const result = await getPaneDatasource({ uid: '${datasource}', type: '' }, [], ORG_ID);

      expect(result?.uid).toBe('loki-uid');
      expect(result?.getRef()).toEqual({ type: 'logs', uid: 'loki-uid' });
    });

    it('resolves a $var carried on a query datasource', async () => {
      const result = await getPaneDatasource(
        null,
        [{ refId: 'A', datasource: legacyStringDs('${datasource}') }],
        ORG_ID
      );

      expect(result?.uid).toBe('loki-uid');
      expect(result?.getRef()).toEqual({ type: 'logs', uid: 'loki-uid' });
    });

    it('falls back to the default datasource when the $var does not interpolate', async () => {
      const result = await getPaneDatasource('${unknown}', [], ORG_ID);

      expect(result?.uid).toBe('default-uid');
    });
  });
});

describe('getDefaultQuery', () => {
  it('builds a query with refId A and the datasource ref', async () => {
    const ds = await getPaneDatasource('loki-uid', [], ORG_ID);

    expect(getDefaultQuery(ds!)).toEqual({ refId: 'A', datasource: { type: 'logs', uid: 'loki-uid' } });
  });

  it("merges the datasource's own default query for Explore", async () => {
    const ds = await getPaneDatasource('with-default-query-uid', [], ORG_ID);

    expect(getDefaultQuery(ds!)).toEqual({
      refId: 'A',
      datasource: { type: 'with-default-query', uid: 'with-default-query-uid' },
      expr: `default for ${CoreApp.Explore}`,
    });
  });
});

describe('isMixedDatasource', () => {
  it('is true only for the mixed datasource', async () => {
    const mixed = await getPaneDatasource('mixed-uid', [], ORG_ID);
    const loki = await getPaneDatasource('loki-uid', [], ORG_ID);

    expect(isMixedDatasource(mixed!)).toBe(true);
    expect(isMixedDatasource(loki!)).toBe(false);
  });
});

describe('getQueryFilter', () => {
  it('keeps only queries that name a datasource when the root is mixed', async () => {
    const mixed = await getPaneDatasource('mixed-uid', [], ORG_ID);
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', datasource: { uid: 'loki-uid' } }];

    expect(queries.filter(getQueryFilter(mixed))).toEqual([queries[1]]);
  });

  it('keeps queries matching the root datasource by ref, uid or name, and those with no datasource', async () => {
    const loki = await getPaneDatasource('loki-uid', [], ORG_ID);
    const queries: DataQuery[] = [
      { refId: 'A' },
      { refId: 'B', datasource: { uid: 'loki-uid' } },
      { refId: 'C', datasource: legacyStringDs('loki-uid') },
      { refId: 'D', datasource: legacyStringDs('loki') },
      { refId: 'E', datasource: { uid: 'elastic-uid' } },
      { refId: 'F', datasource: legacyStringDs('elastic-uid') },
    ];

    expect(queries.filter(getQueryFilter(loki)).map((q) => q.refId)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('keeps only queries with no datasource when there is no root datasource', () => {
    const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B', datasource: { uid: 'loki-uid' } }];

    expect(queries.filter(getQueryFilter(undefined)).map((q) => q.refId)).toEqual(['A']);
  });
});

describe('removeQueriesWithInvalidDatasource', () => {
  it('drops the queries whose datasource does not resolve', async () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'loki-uid' } },
      { refId: 'B', datasource: { uid: 'UNKNOWN-UID' } },
      { refId: 'C', datasource: legacyStringDs('elastic-uid') },
    ];

    const result = await removeQueriesWithInvalidDatasource(queries);

    expect(result.map((q) => q.refId)).toEqual(['A', 'C']);
  });

  it('keeps a query whose datasource is a template variable', async () => {
    const queries: DataQuery[] = [{ refId: 'A', datasource: legacyStringDs('${datasource}') }];

    const result = await removeQueriesWithInvalidDatasource(queries);

    expect(result.map((q) => q.refId)).toEqual(['A']);
  });

  it('keeps queries with no datasource, which inherit the pane one', async () => {
    const result = await removeQueriesWithInvalidDatasource([{ refId: 'A' }]);

    expect(result.map((q) => q.refId)).toEqual(['A']);
  });
});
