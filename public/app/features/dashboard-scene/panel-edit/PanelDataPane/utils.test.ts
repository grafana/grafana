import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { hasBackendDatasource } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

describe('hasBackendDatasource', () => {
  const mockGetDataSourceSrv = getDataSourceSrv as jest.Mock;

  const prometheusSettings = {
    uid: 'prometheus-uid',
    type: 'prometheus',
    name: 'Prometheus',
    meta: { backend: true },
  } as DataSourceInstanceSettings;

  // The expression datasource resolves to settings without meta.backend - see ExpressionDatasource.ts
  const expressionSettings = {
    uid: ExpressionDatasourceUID,
    type: ExpressionDatasourceUID,
    name: 'Expression',
    meta: {},
  } as DataSourceInstanceSettings;

  function mockInstanceSettings(...available: DataSourceInstanceSettings[]) {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn((uid: string) => available.find((settings) => settings.uid === uid) ?? null),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false when datasourceUid is SHARED_DASHBOARD_QUERY', () => {
    const result = hasBackendDatasource({ datasourceUid: SHARED_DASHBOARD_QUERY });
    expect(result).toBe(false);
  });

  it('should return false when datasourceUid is undefined', () => {
    const result = hasBackendDatasource({ datasourceUid: undefined });
    expect(result).toBe(false);
  });

  it('should return false when datasource settings cannot be found', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue(null),
    });

    const result = hasBackendDatasource({ datasourceUid: 'unknown-uid' });
    expect(result).toBe(false);
  });

  it('should return true when datasource has meta.backend === true', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'test-ds',
        type: 'test',
        name: 'Test DS',
        meta: {
          backend: true,
        },
      } as DataSourceInstanceSettings),
    });

    const result = hasBackendDatasource({ datasourceUid: 'test-ds' });
    expect(result).toBe(true);
  });

  it('should return false when datasource has meta.backend === undefined', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'test-ds',
        type: 'test',
        name: 'Test DS',
        meta: {
          // backend is undefined
        },
      } as DataSourceInstanceSettings),
    });

    const result = hasBackendDatasource({ datasourceUid: 'test-ds' });
    expect(result).toBe(false);
  });

  it('should return true when mixed datasource has at least one query using a backend datasource', () => {
    const mockGetInstanceSettings = jest.fn((uid: string) => {
      if (uid === 'mixed-uid') {
        return {
          uid: 'mixed-uid',
          type: 'mixed',
          name: 'Mixed',
          meta: {
            mixed: true,
          },
        } as DataSourceInstanceSettings;
      }
      if (uid === 'prometheus-uid') {
        return {
          uid: 'prometheus-uid',
          type: 'prometheus',
          name: 'Prometheus',
          meta: {
            backend: true,
          },
        } as DataSourceInstanceSettings;
      }
      return null;
    });

    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: mockGetInstanceSettings,
    });

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
      { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
    ];

    const result = hasBackendDatasource({ datasourceUid: 'mixed-uid', queries });
    expect(result).toBe(true);
  });

  // V2 panels only carry a panel level datasource when their queries are mixed.
  it('should fall back to the queries when there is no panel level datasource', () => {
    mockInstanceSettings(prometheusSettings);

    const queries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } }];

    const result = hasBackendDatasource({ datasourceUid: undefined, queries });
    expect(result).toBe(true);
  });

  // Callers that infer the panel datasource from the first query land here when it is an expression.
  it('should fall back to the queries when the panel level datasource is an expression', () => {
    mockInstanceSettings(expressionSettings, prometheusSettings);

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID } },
      { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
    ];

    const result = hasBackendDatasource({ datasourceUid: ExpressionDatasourceUID, queries });
    expect(result).toBe(true);
  });

  it('should return false when the queries only use expressions', () => {
    mockInstanceSettings(expressionSettings);

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID } },
    ];

    const result = hasBackendDatasource({ datasourceUid: undefined, queries });
    expect(result).toBe(false);
  });

  it('should return false when neither the panel nor its queries have a datasource', () => {
    mockInstanceSettings(prometheusSettings);

    const result = hasBackendDatasource({ datasourceUid: undefined, queries: [{ refId: 'A' }] });
    expect(result).toBe(false);
  });
});
