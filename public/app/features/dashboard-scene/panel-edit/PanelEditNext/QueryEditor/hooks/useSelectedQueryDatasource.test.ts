import { renderHook, waitFor } from '@testing-library/react';

import { DataSourceApi, DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { useSelectedQueryDatasource } from './useSelectedQueryDatasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  config: {
    defaultDatasource: 'default-datasource-uid',
  },
}));

const mockGetDataSourceSrv = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

// Mock datasources - using Partial to only define properties we need in tests
const mockTestDataDatasource: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {
  name: 'TestData',
  uid: 'testdata-uid',
  type: 'testdata',
  meta: {
    id: 'testdata',
    name: 'TestData',
    mixed: false,
  } as DataSourcePluginMeta,
  components: {
    QueryEditor: () => null,
  },
};

const mockPrometheusDatasource: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {
  name: 'Prometheus',
  uid: 'prometheus-uid',
  type: 'prometheus',
  meta: {
    id: 'prometheus',
    name: 'Prometheus',
    mixed: false,
  } as DataSourcePluginMeta,
  components: {
    QueryEditor: () => null,
  },
};

const mockMixedDatasource: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {
  name: 'Mixed',
  uid: 'mixed',
  type: 'mixed',
  meta: {
    id: 'mixed',
    name: 'Mixed',
    mixed: true,
  } as DataSourcePluginMeta,
};

const mockTestDataSettings: DataSourceInstanceSettings = {
  uid: 'testdata-uid',
  name: 'TestData',
  type: 'testdata',
  meta: {
    id: 'testdata',
    name: 'TestData',
  } as DataSourcePluginMeta,
  access: 'proxy',
  jsonData: {},
  readOnly: false,
};

const mockMixedSettings: DataSourceInstanceSettings = {
  uid: 'mixed',
  name: 'Mixed',
  type: 'mixed',
  meta: {
    id: 'mixed',
    name: 'Mixed',
    mixed: true,
  } as DataSourcePluginMeta,
  access: 'proxy',
  jsonData: {},
  readOnly: false,
};

const mockPrometheusSettings: DataSourceInstanceSettings = {
  uid: 'prometheus-uid',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus', name: 'Prometheus' } as DataSourcePluginMeta,
  access: 'proxy',
  jsonData: {},
  readOnly: false,
};

/**
 * Helper to create a mock DataSourceSrv with default behavior.
 * Can be overridden for specific test cases.
 */
function createMockDataSourceSrv(overrides?: Partial<ReturnType<typeof getDataSourceSrv>>) {
  const mockDataSourceSrv: Partial<ReturnType<typeof getDataSourceSrv>> = {
    get: jest.fn().mockImplementation((ref: unknown) => {
      const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
      if (uid === 'testdata-uid') {
        return Promise.resolve(mockTestDataDatasource as DataSourceApi);
      }
      if (uid === 'prometheus-uid') {
        return Promise.resolve(mockPrometheusDatasource as DataSourceApi);
      }
      if (uid === 'mixed') {
        return Promise.resolve(mockMixedDatasource as DataSourceApi);
      }
      return Promise.reject(new Error('Unknown datasource'));
    }),
    getInstanceSettings: jest.fn().mockImplementation((ref: unknown) => {
      const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
      if (uid === 'testdata-uid') {
        return mockTestDataSettings;
      }
      if (uid === 'mixed') {
        return mockMixedSettings;
      }
      if (uid === 'prometheus-uid') {
        return mockPrometheusSettings;
      }
      return undefined;
    }),
    ...overrides,
  };

  return mockDataSourceSrv as ReturnType<typeof getDataSourceSrv>;
}

describe('useSelectedQueryDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.defaultDatasource = 'testdata-uid';
    mockGetDataSourceSrv.mockReturnValue(createMockDataSourceSrv());
  });

  describe('explicit datasource behavior', () => {
    it('should use query datasource when explicitly set', async () => {
      const query: DataQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');
    });
  });

  describe('datasource inheritance', () => {
    it('should fall back to panel datasource when query has no explicit datasource', async () => {
      const query: DataQuery = {
        refId: 'A',
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });
  });

  describe('Mixed datasource handling', () => {
    it('should use default datasource when panel datasource is mixed and query has no explicit datasource', async () => {
      const query: DataQuery = {
        refId: 'A',
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockMixedSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      // CRITICAL: Mixed datasource has no QueryEditor component, so we must fall back to default
      // to allow the query to be edited. This prevents the error:
      // "Data source plugin does not export any query editor component"
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });

    it('should use query explicit datasource even when panel is mixed', async () => {
      const query: DataQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockMixedSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      // When query has explicit datasource in a Mixed panel, use that datasource (normal case)
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');
    });
  });

  describe('dynamic query switching', () => {
    it('should correctly handle switching between queries when panel becomes Mixed', async () => {
      // 1. Start with testdata datasource, Query A has no explicit datasource (inherits from panel)
      // 2. Add Query B with Prometheus datasource → panel becomes Mixed
      // 3. Click back on Query A → should still load testdata

      // Step 1: Query A with testdata panel (no explicit datasource on query)
      const queryA: DataQuery = { refId: 'A' };

      const { result, rerender } = renderHook(({ query, settings }) => useSelectedQueryDatasource(query, settings), {
        initialProps: { query: queryA, settings: mockTestDataSettings },
      });

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');

      // Step 2: Switch to Query B with Prometheus (explicit datasource) - panel is now Mixed
      const queryB: DataQuery = {
        refId: 'B',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };

      rerender({ query: queryB, settings: mockMixedSettings });

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');

      // Step 3: Switch BACK to Query A
      // Query A still has no explicit datasource, but panel is now Mixed
      rerender({ query: queryA, settings: mockMixedSettings });

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      // CRITICAL: Should fall back to default datasource (testdata), NOT mixed
      // This prevents "Data source plugin does not export any query editor component" error
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });

    it('should handle rapid query switching without stale data', async () => {
      const queryA: DataQuery = {
        refId: 'A',
        datasource: { uid: 'testdata-uid', type: 'testdata' },
      };

      const { result, rerender } = renderHook(({ query }) => useSelectedQueryDatasource(query, mockTestDataSettings), {
        initialProps: { query: queryA },
      });

      await waitFor(() => {
        expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      });

      // Rapidly switch to Query B
      const queryB: DataQuery = {
        refId: 'B',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };
      rerender({ query: queryB });

      await waitFor(() => {
        expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      });

      // Switch back to Query A
      rerender({ query: queryA });

      await waitFor(() => {
        expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should return null when no query is selected', async () => {
      const { result } = renderHook(() => useSelectedQueryDatasource(null, mockTestDataSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      expect(result.current.selectedQueryDsData).toBe(null);
    });

    it('should return null when datasource cannot be loaded', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const query: DataQuery = {
        refId: 'A',
        datasource: { uid: 'unknown-uid', type: 'unknown' },
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      expect(result.current.selectedQueryDsData).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return null when query has no datasource and panel settings are undefined', async () => {
      const query: DataQuery = {
        refId: 'A',
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, undefined));

      await waitFor(() => {
        expect(result.current.selectedQueryDsLoading).toBe(false);
      });

      expect(result.current.selectedQueryDsData).toBe(null);
    });
  });
});
