import { type DataSourceInstanceSettings, type ScopedVars } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { interpolateSourceQueries } from './interpolateSourceQueries';

const mockGetDatasource = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => (val ? val.replace('$input', '10') : val),
  }),
  getDataSourceInstance: (...args: unknown[]) => mockGetDatasource(...args),
}));

const mockDataSources = (byUid: Record<string, object>) => {
  mockGetDatasource.mockImplementation(async (ref: { uid: string }) => {
    if (!byUid[ref.uid]) {
      throw new Error(`Datasource ${ref.uid} was not found`);
    }
    return byUid[ref.uid];
  });
};

describe('interpolateSourceQueries', () => {
  beforeEach(() => {
    mockGetDatasource.mockReset();
  });

  it('interpolates them in one call so a query can resolve a hidden sibling it references', async () => {
    // Mirrors a data source such as Graphite that resolves `#A` references from sibling queries.
    type GraphiteQuery = DataQuery & { target: string };
    const resolveSiblingRefs = (queries: GraphiteQuery[]) => {
      const targets = new Map(queries.map((q) => [q.refId, q.target]));
      return queries.map((q) => ({
        ...q,
        targetFull: q.target.replace(/#([A-Z])/g, (match, ref) => targets.get(ref) ?? match),
      }));
    };
    const datasource = { uid: 'graphite', type: 'graphite' };
    const hiddenSource: GraphiteQuery = { refId: 'A', hide: true, target: 'metric.a', datasource };
    const nested: GraphiteQuery = { refId: 'B', target: 'sumSeries(#A)', datasource };
    const graphite = { uid: 'graphite', interpolateVariablesInQueries: jest.fn(resolveSiblingRefs) };
    mockDataSources({ graphite });

    const result = await interpolateSourceQueries([hiddenSource, nested], {});

    expect(graphite.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
    expect(graphite.interpolateVariablesInQueries).toHaveBeenCalledWith([hiddenSource, nested], {}, undefined);
    expect(result).toEqual([
      { ...hiddenSource, targetFull: 'metric.a' },
      { ...nested, targetFull: 'sumSeries(metric.a)' },
    ]);
  });

  it('uses `applyTemplateVariables` when the data source overrides it, as the query path does', async () => {
    // Mirrors Prometheus and Loki: `applyTemplateVariables` keeps `$__interval` for the backend,
    // while `interpolateVariablesInQueries` exists for Explore and expands it.
    type PromLikeQuery = DataQuery & { expr: string };
    class PromLikeDatasource extends DataSourceWithBackend<PromLikeQuery> {
      applyTemplateVariables(query: PromLikeQuery, scopedVars: ScopedVars) {
        return { ...query, expr: query.expr.replace('$env', String(scopedVars.env?.value)) };
      }

      interpolateVariablesInQueries(queries: PromLikeQuery[], scopedVars: ScopedVars) {
        return queries.map((query) => ({
          ...query,
          expr: query.expr.replace('$__interval', String(scopedVars.__interval?.value)),
        }));
      }
    }
    const datasource = { uid: 'prom', type: 'prom' };
    const prom = new PromLikeDatasource({ uid: 'prom', type: 'prom', jsonData: {} } as DataSourceInstanceSettings);
    mockDataSources({ prom });
    const query: PromLikeQuery = { refId: 'A', hide: true, expr: 'rate(x{env="$env"}[$__interval])', datasource };
    const scopedVars = { __interval: { text: '2s', value: '2s' }, env: { text: 'prod', value: 'prod' } };

    const result = await interpolateSourceQueries([query], scopedVars);

    expect(result).toEqual([{ ...query, expr: 'rate(x{env="prod"}[$__interval])' }]);
  });

  it('keeps request order and matches results to queries by refId when data sources are interleaved', async () => {
    const a = { refId: 'A', datasource: { uid: 'first', type: 'mysql' } };
    const b = { refId: 'B', datasource: { uid: 'second', type: 'mysql' } };
    const c = { refId: 'C', datasource: { uid: 'first', type: 'mysql' } };
    // Returns its results in reverse order to prove they are matched by refId, not by position.
    const first = {
      uid: 'first',
      interpolateVariablesInQueries: jest.fn((queries: DataQuery[]) =>
        queries.map((q) => ({ ...q, rawSql: `first:${q.refId}` })).reverse()
      ),
    };
    const second = {
      uid: 'second',
      interpolateVariablesInQueries: jest.fn((queries: DataQuery[]) =>
        queries.map((q) => ({ ...q, rawSql: `second:${q.refId}` }))
      ),
    };
    mockDataSources({ first, second });

    const result = await interpolateSourceQueries([a, b, c], {});

    expect(first.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
    expect(first.interpolateVariablesInQueries).toHaveBeenCalledWith([a, c], {}, undefined);
    expect(second.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
    expect(second.interpolateVariablesInQueries).toHaveBeenCalledWith([b], {}, undefined);
    expect(result).toEqual([
      { ...a, rawSql: 'first:A' },
      { ...b, rawSql: 'second:B' },
      { ...c, rawSql: 'first:C' },
    ]);
  });

  it('returns a query unchanged when its data source cannot be loaded', async () => {
    const missing = { refId: 'A', datasource: { uid: 'missing', type: 'mysql' } };
    const found = { refId: 'B', datasource: { uid: 'found', type: 'mysql' } };
    mockDataSources({
      found: {
        uid: 'found',
        interpolateVariablesInQueries: (queries: DataQuery[]) => queries.map((q) => ({ ...q, rawSql: 'done' })),
      },
    });

    const result = await interpolateSourceQueries([missing, found], {});

    expect(result).toEqual([missing, { ...found, rawSql: 'done' }]);
  });

  it('rejects when a data source cannot be loaded and throwOnMissingDataSource is set', async () => {
    const missing = { refId: 'A', datasource: { uid: 'missing', type: 'mysql' } };
    mockDataSources({});

    await expect(
      interpolateSourceQueries([missing], {}, undefined, { throwOnMissingDataSource: true })
    ).rejects.toThrow('Datasource missing was not found');
  });

  it('resolves data sources with dataSourceScopedVars', async () => {
    const query = { refId: 'A', datasource: { uid: '${ds}', type: 'mysql' } };
    const dataSourceScopedVars = { ds: { value: 'mysql_uid', text: 'mysql_uid' } };
    mockGetDatasource.mockResolvedValue({ uid: 'mysql_uid' });

    await interpolateSourceQueries([query], {}, undefined, { dataSourceScopedVars });

    expect(mockGetDatasource).toHaveBeenCalledWith(query.datasource, dataSourceScopedVars);
  });
});
