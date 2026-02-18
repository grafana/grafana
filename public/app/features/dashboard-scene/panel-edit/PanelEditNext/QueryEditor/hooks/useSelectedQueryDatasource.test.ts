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
      return Promise.reject(new Error('Unknown datasource'));
    }),
    getInstanceSettings: jest.fn().mockImplementation((ref: unknown) => {
      const uid = typeof ref === 'string' ? ref : (ref as { uid?: string })?.uid;
      if (uid === 'testdata-uid') {
        return mockTestDataSettings;
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

  describe('datasource resolution', () => {
    it('should use the explicit query datasource when set', async () => {
      const query: DataQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');
    });

    it('should fall back to the panel datasource when the query has no explicit datasource', async () => {
      const query: DataQuery = { refId: 'A' };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });

    it('should fall back to the default datasource when the panel is Mixed and the query has no explicit datasource', async () => {
      const query: DataQuery = { refId: 'A' };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockMixedSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });

    it('should use the explicit query datasource even when the panel is Mixed', async () => {
      const query: DataQuery = {
        refId: 'A',
        datasource: { uid: 'prometheus-uid', type: 'prometheus' },
      };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockMixedSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');
    });
  });

  describe('reactivity', () => {
    it('should fall back to default (not Mixed) when switching back to a query with no explicit datasource after the panel becomes Mixed', async () => {
      // Tests that both query dep (datasource uid) and panelDsSettings dep (uid + mixed flag)
      // trigger re-runs correctly through the full Mixed transition cycle.
      const queryA: DataQuery = { refId: 'A' };
      const queryB: DataQuery = { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } };

      const { result, rerender } = renderHook(({ query, settings }) => useSelectedQueryDatasource(query, settings), {
        initialProps: { query: queryA, settings: mockTestDataSettings },
      });

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');

      // Panel becomes Mixed when queryB is added
      rerender({ query: queryB, settings: mockMixedSettings });
      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('prometheus-uid');

      // Switch back to queryA — panel is still Mixed but queryA has no explicit ds
      rerender({ query: queryA, settings: mockMixedSettings });
      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      // Must resolve to default (testdata), NOT Mixed — Mixed has no QueryEditor component
      expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      expect(result.current.selectedQueryDsData?.dsSettings.uid).toBe('testdata-uid');
    });

    it('should re-run when panelDsSettings arrives after being undefined', async () => {
      // Guards panelDsSettings?.uid in the dep array. If removed, the hook would stay
      // stuck on null after loadDatasource resolves and panelDsSettings is set.
      const query: DataQuery = { refId: 'A' };

      const { result, rerender } = renderHook(({ settings }) => useSelectedQueryDatasource(query, settings), {
        initialProps: { settings: undefined as DataSourceInstanceSettings | undefined },
      });

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));
      expect(result.current.selectedQueryDsData).toBeNull();

      rerender({ settings: mockTestDataSettings });

      await waitFor(() => {
        expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource);
      });
    });

    it('should resolve the correct datasource when switching between queries with different explicit datasources', async () => {
      const queryA: DataQuery = { refId: 'A', datasource: { uid: 'testdata-uid', type: 'testdata' } };
      const queryB: DataQuery = { refId: 'B', datasource: { uid: 'prometheus-uid', type: 'prometheus' } };

      const { result, rerender } = renderHook(({ query }) => useSelectedQueryDatasource(query, mockTestDataSettings), {
        initialProps: { query: queryA },
      });

      await waitFor(() => expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource));

      rerender({ query: queryB });
      await waitFor(() => expect(result.current.selectedQueryDsData?.datasource).toBe(mockPrometheusDatasource));

      rerender({ query: queryA });
      await waitFor(() => expect(result.current.selectedQueryDsData?.datasource).toBe(mockTestDataDatasource));
    });

    it('should not re-fetch when switching between queries that both inherit from the panel', async () => {
      // Both queries have no explicit datasource — the dep array values are identical
      // (selectedDsUid: undefined, panelDsUid: 'testdata-uid'), so useAsync should not re-run.
      const queryA: DataQuery = { refId: 'A' };
      const queryB: DataQuery = { refId: 'B' };

      const { rerender } = renderHook(({ query }) => useSelectedQueryDatasource(query, mockTestDataSettings), {
        initialProps: { query: queryA },
      });

      await waitFor(() => {});
      const callCountAfterA = (mockGetDataSourceSrv().get as jest.Mock).mock.calls.length;

      rerender({ query: queryB });
      await waitFor(() => {});
      const callCountAfterB = (mockGetDataSourceSrv().get as jest.Mock).mock.calls.length;

      expect(callCountAfterB).toBe(callCountAfterA);
    });
  });

  describe('null and error states', () => {
    it('should be in loading state synchronously before the async datasource resolves', async () => {
      const query: DataQuery = { refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      expect(result.current.selectedQueryDsLoading).toBe(true);
      expect(result.current.selectedQueryDsData).toBeFalsy();

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));
    });

    it('should return null when no query is selected', async () => {
      const { result } = renderHook(() => useSelectedQueryDatasource(null, mockTestDataSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData).toBeNull();
    });

    it('should return null (not an error state) when panelDsSettings is not yet loaded', async () => {
      // While PanelDataPaneNext is still loading, panelDsSettings is undefined.
      // The hook must return null here, not trigger the "Failed to load datasource" error
      // that QueryEditorRenderer shows when loading=false AND data is missing.
      const query: DataQuery = { refId: 'A' };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, undefined));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData).toBeNull();
    });

    it('should return null when the datasource cannot be loaded', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const query: DataQuery = { refId: 'A', datasource: { uid: 'unknown-uid', type: 'unknown' } };

      const { result } = renderHook(() => useSelectedQueryDatasource(query, mockTestDataSettings));

      await waitFor(() => expect(result.current.selectedQueryDsLoading).toBe(false));

      expect(result.current.selectedQueryDsData).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
