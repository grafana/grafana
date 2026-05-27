import { of, lastValueFrom } from 'rxjs';

import { dateTime, type DataQueryRequest, type DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { ExpressionDatasourceApi } from './ExpressionDatasource';
import { type ExpressionQuery, ExpressionQueryType } from './types';

const mockGetDatasource = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => ({
    get: mockGetDatasource,
  }),
  getTemplateSrv: () => ({
    replace: (val: string) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
  }),
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
      query: ExpressionQuery,
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
        targets: [query],
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
  });
});
