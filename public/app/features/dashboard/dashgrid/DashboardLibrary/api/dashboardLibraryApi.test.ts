import { BackendSrv, getBackendSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard } from '../types';

import {
  fetchCommunityDashboard,
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
  FetchCommunityDashboardsParams,
  GnetDashboardResponse,
} from './dashboardLibraryApi';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
}));

const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;

// Helper to create mock BackendSrv
const createMockBackendSrv = (overrides: Partial<BackendSrv> = {}): BackendSrv =>
  ({
    get: jest.fn(),
    ...overrides,
  }) as unknown as BackendSrv;

// Helper functions for creating mock objects
const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 1,
  name: 'Test Dashboard',
  description: 'Test Description',
  downloads: 100,
  datasource: 'Prometheus',
  ...overrides,
});

const createMockPluginDashboard = (overrides: Partial<PluginDashboard> = {}): PluginDashboard => ({
  dashboardId: 1,
  uid: 'dash-uid',
  title: 'Test Dashboard',
  pluginId: 'prometheus',
  path: 'dashboards/test.json',
  description: 'Test plugin dashboard',
  imported: false,
  importedRevision: 0,
  importedUri: '',
  importedUrl: '',
  removed: false,
  revision: 1,
  slug: 'test-dashboard',
  ...overrides,
});

const defaultFetchParams: FetchCommunityDashboardsParams = {
  orderBy: 'downloads',
  direction: 'desc',
  page: 1,
  pageSize: 10,
  includeLogo: true,
  includeScreenshots: true,
};

describe('dashboardLibraryApi', () => {
  let mockGet: jest.MockedFunction<BackendSrv['get']>;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockGet = jest.fn();
    mockGetBackendSrv.mockReturnValue(createMockBackendSrv({ get: mockGet }));
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('fetchCommunityDashboards', () => {
    it('should fetch community dashboards with correct query parameters', async () => {
      const mockDashboards = [createMockGnetDashboard({ id: 1 }), createMockGnetDashboard({ id: 2 })];
      const mockResponse = {
        page: 1,
        pages: 5,
        items: mockDashboards,
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchCommunityDashboards(defaultFetchParams);

      expect(mockGet).toHaveBeenCalledWith(
        '/api/gnet/dashboards?orderBy=downloads&direction=desc&page=1&pageSize=10&includeLogo=1&includeScreenshots=true',
        undefined,
        undefined,
        { showErrorAlert: false }
      );

      expect(result).toEqual({
        page: 1,
        pages: 5,
        items: mockDashboards,
      });
    });

    it('should include dataSourceSlugIn when provided', async () => {
      mockGet.mockResolvedValue({ page: 1, pages: 1, items: [] });

      await fetchCommunityDashboards({
        ...defaultFetchParams,
        dataSourceSlugIn: 'prometheus',
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('dataSourceSlugIn=prometheus'),
        undefined,
        undefined,
        { showErrorAlert: false }
      );
    });

    it('should include filter when provided', async () => {
      mockGet.mockResolvedValue({ page: 1, pages: 1, items: [] });

      await fetchCommunityDashboards({
        ...defaultFetchParams,
        filter: 'kubernetes',
      });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('filter=kubernetes'), undefined, undefined, {
        showErrorAlert: false,
      });
    });

    it('should handle unexpected response format and return empty array', async () => {
      const mockResponse = {
        page: 1,
        pages: 1,
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchCommunityDashboards(defaultFetchParams);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Unexpected API response format from Grafana.com:', mockResponse);
      expect(result).toEqual({
        page: 1,
        pages: 1,
        items: [],
      });
    });

    it('should use fallback values when page/pages are missing', async () => {
      const items = [createMockGnetDashboard()];

      mockGet.mockResolvedValue({
        items,
      });

      const result = await fetchCommunityDashboards({
        ...defaultFetchParams,
        page: 3,
      });

      expect(result.page).toBe(3);
      expect(result.pages).toBe(1);
    });
  });

  describe('fetchCommunityDashboard', () => {
    it('should fetch a single dashboard by gnetId', async () => {
      const gnetId = 12345;
      const mockResponse: GnetDashboardResponse = {
        json: {
          title: 'Test Dashboard',
          panels: [],
          schemaVersion: 41,
        } as DashboardJson,
        dependencies: {
          items: [
            {
              pluginSlug: 'prometheus',
              pluginTypeCode: 'datasource',
            },
          ],
        },
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchCommunityDashboard(gnetId);

      expect(mockGet).toHaveBeenCalledWith('/api/gnet/dashboards/12345');
      expect(result).toEqual(mockResponse);
    });

    it('should handle dashboard without dependencies', async () => {
      const gnetId = 999;
      const mockResponse: GnetDashboardResponse = {
        json: {
          title: 'Simple Dashboard',
          panels: [],
          schemaVersion: 41,
        } as DashboardJson,
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchCommunityDashboard(gnetId);

      expect(result).toEqual(mockResponse);
      expect(result.dependencies).toBeUndefined();
    });
  });

  describe('fetchProvisionedDashboards', () => {
    it('should fetch provisioned dashboards for a datasource type', async () => {
      const datasourceType = 'prometheus';
      const mockDashboards: PluginDashboard[] = [
        createMockPluginDashboard({ uid: 'dash-1', title: 'Dashboard 1' }),
        createMockPluginDashboard({ uid: 'dash-2', title: 'Dashboard 2' }),
      ];

      mockGet.mockResolvedValue(mockDashboards);

      const result = await fetchProvisionedDashboards(datasourceType);

      expect(mockGet).toHaveBeenCalledWith('api/plugins/prometheus/dashboards', undefined, undefined, {
        showErrorAlert: false,
      });
      expect(result).toEqual(mockDashboards);
    });

    it('should return empty array when response is not an array', async () => {
      mockGet.mockResolvedValue({ error: 'Not found' });

      const result = await fetchProvisionedDashboards('unknown-plugin');

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      mockGet.mockRejectedValue(error);

      const result = await fetchProvisionedDashboards('prometheus');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading provisioned dashboards', error);
      expect(result).toEqual([]);
    });

    it('should return empty array for datasource with no provisioned dashboards', async () => {
      mockGet.mockResolvedValue([]);

      const result = await fetchProvisionedDashboards('mysql');

      expect(result).toEqual([]);
    });
  });
});
