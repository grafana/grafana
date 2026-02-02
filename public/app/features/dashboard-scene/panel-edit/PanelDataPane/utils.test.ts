import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { areAllDatasourcesFrontend } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

describe('areAllDatasourcesFrontend', () => {
  const mockGetDataSourceSrv = getDataSourceSrv as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when datasourceUid is SHARED_DASHBOARD_QUERY', () => {
    const result = areAllDatasourcesFrontend(SHARED_DASHBOARD_QUERY, []);
    expect(result).toBe(true);
  });

  it('should return false when datasourceUid is undefined', () => {
    const result = areAllDatasourcesFrontend(undefined, []);
    expect(result).toBe(false);
  });

  it('should return false when datasource settings cannot be found', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue(null),
    });

    const result = areAllDatasourcesFrontend('unknown-uid', []);
    expect(result).toBe(false);
  });

  it('should return true when datasource has meta.backend === false', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'test-ds',
        type: 'test',
        name: 'Test DS',
        meta: {
          backend: false,
        },
      } as DataSourceInstanceSettings),
    });

    const result = areAllDatasourcesFrontend('test-ds', []);
    expect(result).toBe(true);
  });

  it('should return true when datasource has meta.backend === undefined', () => {
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

    const result = areAllDatasourcesFrontend('test-ds', []);
    expect(result).toBe(true);
  });

  it('should return false when datasource has meta.backend === true', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'prometheus-uid',
        type: 'prometheus',
        name: 'Prometheus',
        meta: {
          backend: true,
        },
      } as DataSourceInstanceSettings),
    });

    const result = areAllDatasourcesFrontend('prometheus-uid', []);
    expect(result).toBe(false);
  });

  it('should return true when mixed datasource has no queries', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'mixed-uid',
        type: 'mixed',
        name: 'Mixed',
        meta: {
          mixed: true,
        },
      } as DataSourceInstanceSettings),
    });

    const result = areAllDatasourcesFrontend('mixed-uid', []);
    expect(result).toBe(true);
  });

  it('should return true when mixed datasource has all queries using Dashboard datasource', () => {
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
      if (uid === SHARED_DASHBOARD_QUERY) {
        return {
          uid: SHARED_DASHBOARD_QUERY,
          type: 'dashboard',
          name: 'Dashboard',
          meta: {
            backend: false,
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
      { refId: 'B', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
    ];

    const result = areAllDatasourcesFrontend('mixed-uid', queries);
    expect(result).toBe(true);
  });

  it('should return true when mixed datasource has all queries using frontend datasources', () => {
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
      if (uid === 'frontend-ds-1') {
        return {
          uid: 'frontend-ds-1',
          type: 'test',
          name: 'Frontend DS 1',
          meta: {
            backend: false,
          },
        } as DataSourceInstanceSettings;
      }
      if (uid === 'frontend-ds-2') {
        return {
          uid: 'frontend-ds-2',
          type: 'test',
          name: 'Frontend DS 2',
          meta: {
            // backend is undefined
          },
        } as DataSourceInstanceSettings;
      }
      return null;
    });

    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: mockGetInstanceSettings,
    });

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'frontend-ds-1', type: 'test' } },
      { refId: 'B', datasource: { uid: 'frontend-ds-2', type: 'test' } },
    ];

    const result = areAllDatasourcesFrontend('mixed-uid', queries);
    expect(result).toBe(true);
  });

  it('should return false when mixed datasource has at least one query using a backend datasource', () => {
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
      if (uid === SHARED_DASHBOARD_QUERY) {
        return {
          uid: SHARED_DASHBOARD_QUERY,
          type: 'dashboard',
          name: 'Dashboard',
          meta: {
            backend: false,
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

    const result = areAllDatasourcesFrontend('mixed-uid', queries);
    expect(result).toBe(false);
  });

  it('should return false when mixed datasource has a query with unknown datasource', () => {
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
      return null; // Unknown datasource
    });

    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: mockGetInstanceSettings,
    });

    const queries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'unknown-uid', type: 'test' } }];

    const result = areAllDatasourcesFrontend('mixed-uid', queries);
    expect(result).toBe(false);
  });

  it('should return true when mixed datasource has queries without datasource reference', () => {
    mockGetDataSourceSrv.mockReturnValue({
      getInstanceSettings: jest.fn().mockReturnValue({
        uid: 'mixed-uid',
        type: 'mixed',
        name: 'Mixed',
        meta: {
          mixed: true,
        },
      } as DataSourceInstanceSettings),
    });

    const queries: DataQuery[] = [
      { refId: 'A' }, // No datasource reference
    ];

    const result = areAllDatasourcesFrontend('mixed-uid', queries);
    expect(result).toBe(true);
  });
});
