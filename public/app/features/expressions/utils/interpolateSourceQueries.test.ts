import { type DataQuery } from '@grafana/schema';
import { GraphiteDatasource } from 'app/plugins/datasource/graphite/datasource';
import { type GraphiteQuery } from 'app/plugins/datasource/graphite/types';

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

  it('lets Graphite resolve a reference to a hidden sibling query', async () => {
    const graphite = new GraphiteDatasource({ uid: 'graphite', type: 'graphite', jsonData: {} });
    const datasource = { uid: 'graphite', type: 'graphite' };
    const hiddenSource: GraphiteQuery = { refId: 'A', hide: true, target: 'metric.$input', datasource };
    const nested: GraphiteQuery = { refId: 'B', target: 'sumSeries(#A)', datasource };
    mockDataSources({ graphite });

    const result = await interpolateSourceQueries([hiddenSource, nested], {});

    expect(result).toEqual([
      expect.objectContaining({ refId: 'A', target: 'metric.10' }),
      expect.objectContaining({ refId: 'B', targetFull: 'sumSeries(metric.10)' }),
    ]);
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
});
