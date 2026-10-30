import { of, lastValueFrom } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import {
  dateTime,
  type DataFrame,
  type DataFrameType,
  type DataQueryRequest,
  type DataSourceInstanceSettings,
  type ScopedVars,
  dataFrameToJSON,
  FieldType,
  getFieldDisplayName,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import { GraphiteDatasource } from 'app/plugins/datasource/graphite/datasource';

import { ExpressionDatasourceApi } from './ExpressionDatasource';
import { type ExpressionQuery, ExpressionQueryType } from './types';

const mockGetDatasource = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => ({
    replace: (val: string) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
  }),
  getDataSourceInstance: (...args: unknown[]) => mockGetDatasource(...args),
}));
describe('ExpressionDatasourceApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDatasource.mockReset();
  });

  describe('expression queries with template variables', () => {
    it('should interpolate template variables in expression query', () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const query = ds.applyTemplateVariables(
        { type: ExpressionQueryType.math, refId: 'B', expression: '$input + 5 + $A' },
        {}
      );
      expect(query.expression).toBe('10 + 5 + $A');
    });
    it('should interpolate template variables in expression query', () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const query = ds.applyTemplateVariables(
        { type: ExpressionQueryType.resample, refId: 'B', window: '$window' },
        {}
      );
      expect(query.window).toBe('10s');
    });
  });

  describe('query datasource scoping', () => {
    const buildRequest = (
      query: ExpressionQuery | ExpressionQuery[],
      scopedVars: Record<string, { value: string; text: string }>
    ): DataQueryRequest<ExpressionQuery> =>
      ({
        app: 'dashboard',
        requestId: 'Q1',
        timezone: 'browser',
        range: {
          from: dateTime('2026-01-01T00:00:00Z'),
          to: dateTime('2026-01-01T01:00:00Z'),
          raw: { from: 'now-1h', to: 'now' },
        },
        targets: Array.isArray(query) ? query : [query],
        scopedVars,
        filters: [],
        interval: '1m',
        intervalMs: 60000,
        maxDataPoints: 100,
        startTime: Date.now(),
        rangeRaw: { from: 'now-1h', to: 'now' },
      }) as DataQueryRequest<ExpressionQuery>;

    it('passes scopedVars when resolving query datasources', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const scopedVars = { datasource: { value: 'mysql_uid', text: 'mysql_uid' } };
      const query: ExpressionQuery = {
        type: ExpressionQueryType.math,
        refId: 'A',
        expression: '$A + $B',
        datasource: { uid: '${datasource}', type: 'mysql' },
      };
      const interpolateVariablesInQueries = jest.fn().mockReturnValue([
        {
          ...query,
          expression: '$A + $B + 1',
        },
      ]);

      mockGetDatasource.mockResolvedValue({ interpolateVariablesInQueries });
      const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

      await lastValueFrom(ds.query(buildRequest(query, scopedVars)));

      expect(mockGetDatasource).toHaveBeenCalledWith(query.datasource, scopedVars);
      expect(interpolateVariablesInQueries).toHaveBeenCalledWith([query], scopedVars, []);
      expect(querySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: [expect.objectContaining({ expression: '$A + $B + 1' })],
        })
      );
    });

    it('keeps query unchanged when datasource has no interpolation hook', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const scopedVars = { datasource: { value: 'mysql_uid', text: 'mysql_uid' } };
      const query: ExpressionQuery = {
        type: ExpressionQueryType.math,
        refId: 'A',
        expression: '$A + $B',
        datasource: { uid: '${datasource}', type: 'mysql' },
      };

      mockGetDatasource.mockResolvedValue({});
      const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

      await lastValueFrom(ds.query(buildRequest(query, scopedVars)));

      expect(mockGetDatasource).toHaveBeenCalledWith(query.datasource, scopedVars);
      expect(querySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: [expect.objectContaining({ expression: '$A + $B' })],
        })
      );
    });

    describe('when several queries share a data source', () => {
      // Mirrors a data source such as Graphite that resolves `#A` references from sibling queries.
      type GraphiteQuery = DataQuery & { target: string };
      // The expression path types every query as `ExpressionQuery`, even data source queries.
      const asExpressionQuery = (query: GraphiteQuery) => query as unknown as ExpressionQuery;
      const resolveSiblingRefs = (queries: GraphiteQuery[]) => {
        const targets = new Map(queries.map((q) => [q.refId, q.target]));
        return queries.map((q) => ({
          ...q,
          targetFull: q.target.replace(/#([A-Z])/g, (match, ref) => targets.get(ref) ?? match),
        }));
      };

      const mockDataSources = (byUid: Record<string, object>) => {
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => byUid[ref.uid]);
      };

      it('interpolates them in one call so a query can resolve a hidden sibling it references', async () => {
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const hiddenSource = asExpressionQuery({
          refId: 'A',
          hide: true,
          target: 'metric.a',
          datasource: { uid: 'graphite', type: 'graphite' },
        });
        const nested = asExpressionQuery({
          refId: 'B',
          target: 'sumSeries(#A)',
          datasource: { uid: 'graphite', type: 'graphite' },
        });
        const sql: ExpressionQuery = {
          type: ExpressionQueryType.sql,
          refId: 'C',
          expression: 'SELECT * FROM B',
          datasource: { uid: '__expr__', type: '__expr__' },
        };
        const graphite = { uid: 'graphite', interpolateVariablesInQueries: jest.fn(resolveSiblingRefs) };
        const expr = { uid: '__expr__', interpolateVariablesInQueries: jest.fn((queries) => queries) };
        mockDataSources({ graphite, __expr__: expr });
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([hiddenSource, nested, sql], {})));

        expect(graphite.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
        expect(graphite.interpolateVariablesInQueries).toHaveBeenCalledWith([hiddenSource, nested], {}, []);
        expect(expr.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
        expect(expr.interpolateVariablesInQueries).toHaveBeenCalledWith([sql], {}, []);
        expect(querySpy).toHaveBeenCalledTimes(1);
        expect(querySpy.mock.calls[0][0].targets).toEqual([
          { ...hiddenSource, targetFull: 'metric.a' },
          { ...nested, targetFull: 'sumSeries(metric.a)' },
          sql,
        ]);
      });

      it('lets the real Graphite data source resolve a reference to a hidden sibling query', async () => {
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const graphite = new GraphiteDatasource({ uid: 'graphite', type: 'graphite', jsonData: {} });
        const datasource = { uid: 'graphite', type: 'graphite' };
        const hiddenSource = asExpressionQuery({ refId: 'A', hide: true, target: 'metric.$input', datasource });
        const nested = asExpressionQuery({ refId: 'B', target: 'sumSeries(#A)', datasource });
        const sql: ExpressionQuery = {
          type: ExpressionQueryType.sql,
          refId: 'C',
          expression: 'SELECT * FROM B',
          datasource: { uid: '__expr__', type: '__expr__' },
        };
        mockDataSources({ graphite, __expr__: ds });
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([hiddenSource, nested, sql], {})));

        expect(querySpy.mock.calls[0][0].targets).toEqual([
          expect.objectContaining({ refId: 'A', target: 'metric.10' }),
          expect.objectContaining({ refId: 'B', targetFull: 'sumSeries(metric.10)' }),
          sql,
        ]);
      });

      it('keeps request order and matches results to queries by refId when data sources are interleaved', async () => {
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const a = { refId: 'A', datasource: { uid: 'first', type: 'mysql' } } as ExpressionQuery;
        const b = { refId: 'B', datasource: { uid: 'second', type: 'mysql' } } as ExpressionQuery;
        const c = { refId: 'C', datasource: { uid: 'first', type: 'mysql' } } as ExpressionQuery;
        // Returns its results in reverse order to prove they are matched by refId, not by position.
        const first = {
          uid: 'first',
          interpolateVariablesInQueries: jest.fn((queries: ExpressionQuery[]) =>
            queries.map((q) => ({ ...q, expression: `first:${q.refId}` })).reverse()
          ),
        };
        const second = {
          uid: 'second',
          interpolateVariablesInQueries: jest.fn((queries: ExpressionQuery[]) =>
            queries.map((q) => ({ ...q, expression: `second:${q.refId}` }))
          ),
        };
        mockDataSources({ first, second });
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([a, b, c], {})));

        expect(first.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
        expect(first.interpolateVariablesInQueries).toHaveBeenCalledWith([a, c], {}, []);
        expect(second.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
        expect(second.interpolateVariablesInQueries).toHaveBeenCalledWith([b], {}, []);
        expect(querySpy).toHaveBeenCalledTimes(1);
        expect(querySpy.mock.calls[0][0].targets).toEqual([
          { ...a, expression: 'first:A' },
          { ...b, expression: 'second:B' },
          { ...c, expression: 'first:C' },
        ]);
      });
    });

    describe('prepares data source queries as a panel does', () => {
      type PromLikeQuery = DataQuery & { expr: string; legendFormat?: string };
      const asExpressionQuery = (query: PromLikeQuery) => query as unknown as ExpressionQuery;
      const replace = (text: string | undefined, scopedVars: ScopedVars) =>
        text?.replace(/\$(\w+)/g, (match: string, name: string) => String(scopedVars[name]?.value ?? match));
      const settings = (uid: string) => ({ uid, type: uid, jsonData: {} }) as DataSourceInstanceSettings;

      // Mirrors how Prometheus and Loki prepare queries. `applyTemplateVariables` runs after `query()`
      // in a panel: it keeps `$__interval` for the backend and fills in `legendFormat`.
      // `interpolateVariablesInQueries` exists for Explore and does neither.
      class PromLikeDatasource extends DataSourceWithBackend<PromLikeQuery> {
        applyTemplateVariables(query: PromLikeQuery, scopedVars: ScopedVars) {
          const variables = { ...scopedVars, __interval: { value: '$__interval' } };
          return {
            ...query,
            expr: replace(query.expr, variables) ?? '',
            legendFormat: replace(query.legendFormat, variables),
          };
        }

        interpolateVariablesInQueries(queries: PromLikeQuery[], scopedVars: ScopedVars) {
          return queries.map((query) => ({
            ...query,
            datasource: this.getRef(),
            expr: replace(query.expr, scopedVars) ?? '',
          }));
        }
      }

      const scopedVars = {
        __interval: { text: '2s', value: '2s' },
        env: { text: 'prod', value: 'prod' },
      };
      const sql: ExpressionQuery = {
        type: ExpressionQueryType.sql,
        refId: 'B',
        expression: 'SELECT * FROM A',
        datasource: { uid: '__expr__', type: '__expr__' },
      };

      it('uses `applyTemplateVariables`, so `$__interval` reaches the backend and `legendFormat` is filled in', async () => {
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const prom = new PromLikeDatasource(settings('prom'));
        const query = asExpressionQuery({
          refId: 'A',
          expr: 'rate(x[$__interval])',
          legendFormat: '{{job}} $env',
          datasource: { uid: 'prom', type: 'prom' },
        });
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => (ref.uid === 'prom' ? prom : ds));
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([query, sql], scopedVars)));

        expect(querySpy.mock.calls[0][0].targets[0]).toEqual(
          expect.objectContaining({ refId: 'A', expr: 'rate(x[$__interval])', legendFormat: '{{job}} prod' })
        );
      });

      it('prefers `prepareBackendQueries` and passes it all of the data source queries and the request', async () => {
        class PreparingDatasource extends PromLikeDatasource {
          prepareBackendQueries = jest.fn((request: DataQueryRequest<PromLikeQuery>) =>
            request.targets.map((query) => ({ ...query, expr: `${query.expr} @ ${request.timezone}` }))
          );
        }
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const prom = new PreparingDatasource(settings('prom'));
        const datasource = { uid: 'prom', type: 'prom' };
        const a = asExpressionQuery({ refId: 'A', expr: 'a', datasource });
        const c = asExpressionQuery({ refId: 'C', expr: 'c', datasource });
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => (ref.uid === 'prom' ? prom : ds));
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([a, sql, c], scopedVars)));

        expect(prom.prepareBackendQueries).toHaveBeenCalledTimes(1);
        expect(prom.prepareBackendQueries).toHaveBeenCalledWith(
          expect.objectContaining({ targets: [a, c], timezone: 'browser', scopedVars })
        );
        expect(querySpy.mock.calls[0][0].targets).toEqual([
          { ...a, expr: 'a @ browser' },
          sql,
          { ...c, expr: 'c @ browser' },
        ]);
      });

      it('keeps `interpolateVariablesInQueries` when the data source does not override `applyTemplateVariables`', async () => {
        // Such as Azure Monitor, whose `query()` hands queries to inner data sources.
        class ExploreOnlyDatasource extends DataSourceWithBackend<PromLikeQuery> {
          interpolateVariablesInQueries(queries: PromLikeQuery[], scopedVars: ScopedVars) {
            return queries.map((query) => ({ ...query, expr: replace(query.expr, scopedVars) ?? '' }));
          }
        }
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const azure = new ExploreOnlyDatasource(settings('azure'));
        const query = asExpressionQuery({ refId: 'A', expr: 'x $env', datasource: { uid: 'azure', type: 'azure' } });
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => (ref.uid === 'azure' ? azure : ds));
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([query, sql], scopedVars)));

        expect(querySpy.mock.calls[0][0].targets[0]).toEqual({ ...query, expr: 'x prod' });
      });

      it('keeps the data source and `hide` when `applyTemplateVariables` builds a new query', async () => {
        // Such as `@grafana/sql`, which sends only the fields its backend reads.
        class SqlLikeDatasource extends DataSourceWithBackend<PromLikeQuery> {
          applyTemplateVariables(query: PromLikeQuery, scopedVars: ScopedVars) {
            return { refId: query.refId, expr: replace(query.expr, scopedVars) ?? '' };
          }
        }
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const mysql = new SqlLikeDatasource(settings('mysql'));
        const datasource = { uid: 'mysql', type: 'mysql' };
        const query = asExpressionQuery({ refId: 'A', hide: true, expr: 'SELECT $env', datasource });
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => (ref.uid === 'mysql' ? mysql : ds));
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));

        await lastValueFrom(ds.query(buildRequest([query, sql], scopedVars)));

        expect(querySpy.mock.calls[0][0].targets[0]).toEqual({
          refId: 'A',
          hide: true,
          expr: 'SELECT prod',
          datasource,
        });
      });

      it('gives each data source its own scopedVars, so one that changes them does not affect the next', async () => {
        // Such as InfluxDB, whose `applyTemplateVariables` sets `__interval` on the scopedVars it gets.
        class MutatingDatasource extends DataSourceWithBackend<PromLikeQuery> {
          applyTemplateVariables(query: PromLikeQuery, scopedVars: ScopedVars) {
            const expr = replace(query.expr, scopedVars) ?? '';
            scopedVars.__interval = { value: '$__interval' };
            return { ...query, expr };
          }
        }
        const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
        const byUid: Record<string, MutatingDatasource> = {
          influx1: new MutatingDatasource(settings('influx1')),
          influx2: new MutatingDatasource(settings('influx2')),
        };
        const a = asExpressionQuery({
          refId: 'A',
          expr: 'a $__interval',
          datasource: { uid: 'influx1', type: 'influx' },
        });
        const c = asExpressionQuery({
          refId: 'C',
          expr: 'c $__interval',
          datasource: { uid: 'influx2', type: 'influx' },
        });
        mockGetDatasource.mockImplementation(async (ref: { uid: string }) => byUid[ref.uid] ?? ds);
        const querySpy = jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [] }));
        const callerScopedVars = { __interval: { text: '2s', value: '2s' } };

        await lastValueFrom(ds.query(buildRequest([a, sql, c], callerScopedVars)));

        expect(querySpy.mock.calls[0][0].targets[2]).toEqual(expect.objectContaining({ expr: 'c 2s' }));
        expect(callerScopedVars).toEqual({ __interval: { text: '2s', value: '2s' } });
      });
    });

    it('restores display names for a SQL expression and its converted source frame', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const sourceQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus', type: 'prometheus' },
      } as ExpressionQuery;
      const sqlQuery: ExpressionQuery = {
        type: ExpressionQueryType.sql,
        refId: 'B',
        expression: 'SELECT * FROM A',
        datasource: { uid: '__expr__', type: '__expr__' },
      };
      const sourceFrame = toDataFrame({
        refId: 'A',
        meta: { type: 'timeseries-full-long' as DataFrameType },
        fields: [
          { name: '__value__', type: FieldType.number, values: [1] },
          { name: '__display_name__', type: FieldType.string, values: ['source'] },
        ],
      });
      const sqlFrame = toDataFrame({
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2] },
          { name: '__value__', type: FieldType.number, config: { unit: 'short' }, values: [10, 20] },
          { name: '__display_name__', type: FieldType.string, values: ['x', 'x'] },
        ],
      });
      const staleState = { displayName: 'stale' };
      sqlFrame.fields[1].state = staleState;

      mockGetDatasource.mockResolvedValue({});
      jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [sourceFrame, sqlFrame] }));

      const response = await lastValueFrom(ds.query(buildRequest([sourceQuery, sqlQuery], {})));

      const sourceResultFrame = response.data[0] as DataFrame;
      expect(sourceResultFrame).not.toBe(sourceFrame);
      expect(sourceResultFrame.fields[0].config.displayNameFromDS).toBe('source');
      expect(getFieldDisplayName(sourceResultFrame.fields[0], sourceResultFrame, [sourceResultFrame])).toBe('source');
      expect(sourceFrame.fields[0].config.displayNameFromDS).toBeUndefined();
      const resultFrame = response.data[1] as DataFrame;
      expect(resultFrame).not.toBe(sqlFrame);
      expect(resultFrame.fields[1].config).toEqual({ unit: 'short', displayNameFromDS: 'x' });
      expect(resultFrame.fields[1].state).toBeNull();
      expect(getFieldDisplayName(resultFrame.fields[1], resultFrame, [resultFrame])).toBe('x');
      expect(sqlFrame.fields[1].config).toEqual({ unit: 'short' });
      expect(sqlFrame.fields[1].state).toBe(staleState);
    });

    it('does not treat a datasource SQL query as a SQL expression', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const query = {
        type: ExpressionQueryType.sql,
        refId: 'A',
        datasource: { uid: 'mysql', type: 'mysql' },
      } as ExpressionQuery;
      const frame = toDataFrame({
        refId: 'A',
        meta: { type: 'timeseries-full-long' as DataFrameType },
        fields: [
          { name: '__value__', type: FieldType.number, values: [30] },
          { name: '__display_name__', type: FieldType.string, values: ['third-party'] },
        ],
      });

      mockGetDatasource.mockResolvedValue({});
      jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [frame] }));

      const response = await lastValueFrom(ds.query(buildRequest(query, {})));

      expect(response.data[0]).toBe(frame);
      expect(frame.fields[0].config.displayNameFromDS).toBeUndefined();
    });

    it('restores the reserved value field when other numeric fields are present', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const query: ExpressionQuery = {
        type: ExpressionQueryType.sql,
        refId: 'B',
        expression: 'SELECT * FROM A',
        datasource: { uid: '__expr__', type: '__expr__' },
      };
      const frame = toDataFrame({
        refId: 'B',
        fields: [
          { name: '__value__', type: FieldType.number, values: [1] },
          { name: 'other', type: FieldType.number, values: [2] },
          { name: '__display_name__', type: FieldType.string, values: ['A'] },
        ],
      });

      mockGetDatasource.mockResolvedValue({});
      jest.spyOn(DataSourceWithBackend.prototype, 'query').mockReturnValue(of({ data: [frame] }));

      const response = await lastValueFrom(ds.query(buildRequest(query, {})));

      const resultFrame = response.data[0] as DataFrame;
      expect(resultFrame).not.toBe(frame);
      expect(resultFrame.fields[0].config.displayNameFromDS).toBe('A');
      expect(resultFrame.fields[1].config.displayNameFromDS).toBeUndefined();
      expect(frame.fields[0].config.displayNameFromDS).toBeUndefined();
    });

    it('does not restore an ambiguous SQL expression display name or a frame without a value field', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      const query: ExpressionQuery = {
        type: ExpressionQueryType.sql,
        refId: 'B',
        expression: 'SELECT * FROM A',
        datasource: { uid: '__expr__', type: '__expr__' },
      };
      const differentNames = toDataFrame({
        refId: 'B',
        fields: [
          { name: '__value__', type: FieldType.number, values: [1, 2] },
          { name: '__display_name__', type: FieldType.string, values: ['A', 'B'] },
        ],
      });
      const missingValue = toDataFrame({
        refId: 'B',
        fields: [
          { name: 'n', type: FieldType.number, values: [1] },
          { name: '__display_name__', type: FieldType.string, values: ['A'] },
        ],
      });

      mockGetDatasource.mockResolvedValue({});
      jest
        .spyOn(DataSourceWithBackend.prototype, 'query')
        .mockReturnValue(of({ data: [differentNames, missingValue] }));

      const response = await lastValueFrom(ds.query(buildRequest(query, {})));

      expect(response.data[0]).toBe(differentNames);
      expect(response.data[1]).toBe(missingValue);
      expect(differentNames.fields[0].config.displayNameFromDS).toBeUndefined();
      expect(missingValue.fields[0].config.displayNameFromDS).toBeUndefined();
    });
  });

  describe('runMetaSQLExprQuery', () => {
    const range = {
      from: dateTime('2026-01-01T00:00:00Z'),
      to: dateTime('2026-01-01T01:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    };
    const sourceFrame = toDataFrame({
      refId: 'A',
      fields: [{ name: 'raw_source_field', type: FieldType.number, values: [1] }],
    });
    const metaFrame = toDataFrame({
      refId: 'fields-1',
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'cpu', type: FieldType.number, values: [1] },
      ],
    });

    const mockQueryResults = (results: Record<string, DataFrame>) =>
      jest.spyOn(backendSrv, 'fetch').mockReturnValue(
        of(
          createFetchResponse({
            results: Object.fromEntries(
              Object.entries(results).map(([refId, frame]) => [refId, { frames: [dataFrameToJSON(frame)] }])
            ),
          })
        )
      );

    it.each<{ desc: string; results: Record<string, DataFrame> }>([
      { desc: 'visible', results: { A: sourceFrame, 'fields-1': metaFrame } },
      // The backend drops hidden refIds from the response but still returns the meta expression result.
      { desc: 'hidden', results: { 'fields-1': metaFrame } },
    ])('returns the meta SQL expression frame when the source query is $desc', async ({ results }) => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      mockQueryResults(results);

      const frame = await ds.runMetaSQLExprQuery({ rawSql: 'SELECT * FROM A LIMIT 1', refId: 'fields-1' }, range, [
        { refId: 'A', hide: true },
      ]);

      expect(frame.fields.map((field) => field.name)).toEqual(['time', 'cpu']);
    });

    it('returns an empty frame when the meta SQL expression has no result', async () => {
      const ds = new ExpressionDatasourceApi({} as DataSourceInstanceSettings);
      mockQueryResults({ A: sourceFrame });

      const frame = await ds.runMetaSQLExprQuery({ rawSql: 'SELECT * FROM A LIMIT 1', refId: 'fields-1' }, range, [
        { refId: 'A' },
      ]);

      expect(frame).toEqual({ fields: [] });
    });
  });
});
