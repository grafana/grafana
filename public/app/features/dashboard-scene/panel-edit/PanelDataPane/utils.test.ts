import { renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { hasBackendDatasource, useHasBackendDatasource } from './utils';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

describe('hasBackendDatasource', () => {
  const mockGetDataSourceInstanceSettings = getDataSourceInstanceSettings as jest.MockedFunction<
    typeof getDataSourceInstanceSettings
  >;

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
    mockGetDataSourceInstanceSettings.mockImplementation(async (uid) => {
      const resolvedUid = typeof uid === 'string' ? uid : uid?.uid;
      return available.find((settings) => settings.uid === resolvedUid);
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return false when datasourceUid is SHARED_DASHBOARD_QUERY', async () => {
    const result = await hasBackendDatasource({ datasourceUid: SHARED_DASHBOARD_QUERY });
    expect(result).toBe(false);
  });

  it('should return false when datasourceUid is undefined', async () => {
    const result = await hasBackendDatasource({ datasourceUid: undefined });
    expect(result).toBe(false);
  });

  it('should return false when datasource settings cannot be found', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);

    const result = await hasBackendDatasource({ datasourceUid: 'unknown-uid' });
    expect(result).toBe(false);
  });

  it('should return true when datasource has meta.backend === true', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({
      uid: 'test-ds',
      type: 'test',
      name: 'Test DS',
      meta: {
        backend: true,
      },
    } as DataSourceInstanceSettings);

    const result = await hasBackendDatasource({ datasourceUid: 'test-ds' });
    expect(result).toBe(true);
  });

  it('should return false when datasource has meta.backend === undefined', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({
      uid: 'test-ds',
      type: 'test',
      name: 'Test DS',
      meta: {
        // backend is undefined
      },
    } as DataSourceInstanceSettings);

    const result = await hasBackendDatasource({ datasourceUid: 'test-ds' });
    expect(result).toBe(false);
  });

  it('should return true when mixed datasource has at least one query using a backend datasource', async () => {
    mockGetDataSourceInstanceSettings.mockImplementation(async (uid) => {
      const resolvedUid = typeof uid === 'string' ? uid : uid?.uid;
      if (resolvedUid === 'mixed-uid') {
        return {
          uid: 'mixed-uid',
          type: 'mixed',
          name: 'Mixed',
          meta: {
            mixed: true,
          },
        } as DataSourceInstanceSettings;
      }
      if (resolvedUid === 'prometheus-uid') {
        return {
          uid: 'prometheus-uid',
          type: 'prometheus',
          name: 'Prometheus',
          meta: {
            backend: true,
          },
        } as DataSourceInstanceSettings;
      }
      return undefined;
    });

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'dashboard' } },
      { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
    ];

    const result = await hasBackendDatasource({ datasourceUid: 'mixed-uid', queries });
    expect(result).toBe(true);
  });

  // V2 panels only carry a panel level datasource when their queries are mixed.
  it('should fall back to the queries when there is no panel level datasource', async () => {
    mockInstanceSettings(prometheusSettings);

    const queries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } }];

    const result = await hasBackendDatasource({ datasourceUid: undefined, queries });
    expect(result).toBe(true);
  });

  // Callers that infer the panel datasource from the first query land here when it is an expression.
  it('should fall back to the queries when the panel level datasource is an expression', async () => {
    mockInstanceSettings(expressionSettings, prometheusSettings);

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID } },
      { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
    ];

    const result = await hasBackendDatasource({ datasourceUid: ExpressionDatasourceUID, queries });
    expect(result).toBe(true);
  });

  it('should return false when the queries only use expressions', async () => {
    mockInstanceSettings(expressionSettings);

    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID } },
    ];

    const result = await hasBackendDatasource({ datasourceUid: undefined, queries });
    expect(result).toBe(false);
  });

  it('should return false when neither the panel nor its queries have a datasource', async () => {
    mockInstanceSettings(prometheusSettings);

    const result = await hasBackendDatasource({ datasourceUid: undefined, queries: [{ refId: 'A' }] });
    expect(result).toBe(false);
  });
});

describe('useHasBackendDatasource', () => {
  const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);

  const backendSettings = {
    uid: 'backend-ds',
    type: 'prometheus',
    name: 'Prometheus',
    meta: { backend: true },
  } as DataSourceInstanceSettings;

  const frontendSettings = {
    uid: 'frontend-ds',
    type: 'grafana',
    name: 'Grafana',
    meta: {},
  } as DataSourceInstanceSettings;

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined until the datasource lookup resolves', async () => {
    const pending = deferred<DataSourceInstanceSettings | undefined>();
    mockGetDataSourceInstanceSettings.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useHasBackendDatasource({ datasourceUid: 'backend-ds' }));

    expect(result.current).toBeUndefined();

    pending.resolve(backendSettings);

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('clears a previous true while a frontend lookup is in flight', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValueOnce(backendSettings);

    const { result, rerender } = renderHook(({ datasourceUid }) => useHasBackendDatasource({ datasourceUid }), {
      initialProps: { datasourceUid: 'backend-ds' },
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    const pending = deferred<DataSourceInstanceSettings | undefined>();
    mockGetDataSourceInstanceSettings.mockReturnValue(pending.promise);

    rerender({ datasourceUid: 'frontend-ds' });

    expect(result.current).toBeUndefined();

    pending.resolve(frontendSettings);

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('does not apply a stale backend result after switching to a frontend datasource', async () => {
    const first = deferred<DataSourceInstanceSettings | undefined>();
    const second = deferred<DataSourceInstanceSettings | undefined>();
    mockGetDataSourceInstanceSettings.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ datasourceUid }) => useHasBackendDatasource({ datasourceUid }), {
      initialProps: { datasourceUid: 'backend-ds' },
    });

    expect(result.current).toBeUndefined();

    rerender({ datasourceUid: 'frontend-ds' });
    expect(result.current).toBeUndefined();

    first.resolve(backendSettings);
    await Promise.resolve();
    expect(result.current).toBeUndefined();

    second.resolve(frontendSettings);

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
