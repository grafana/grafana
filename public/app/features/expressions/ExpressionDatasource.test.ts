import { of, lastValueFrom } from 'rxjs';

import {
  dateTime,
  type DataFrame,
  type DataFrameType,
  type DataQueryRequest,
  type DataSourceInstanceSettings,
  FieldType,
  getFieldDisplayName,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { ExpressionDatasourceApi } from './ExpressionDatasource';
import { type ExpressionQuery, ExpressionQueryType } from './types';

const mockGetDatasource = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => ({
    replace: (val: string) => (val ? val.replace('$input', '10').replace('$window', '10s') : val),
  }),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
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
});
