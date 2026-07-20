import { type BackendSrv, getBackendSrv, logInfo, logWarning } from '@grafana/runtime';
import { type DashboardJson } from 'app/features/manage-dashboards/types';
import { type PluginDashboard } from 'app/types/plugins';

import { type GnetDashboard } from '../types';
import { createMockGnetDashboard, createMockPluginDashboard } from '../utils/test-utils';

import {
  fetchCommunityDashboard,
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
  type FetchCommunityDashboardsParams,
  type GnetDashboardResponse,
} from './dashboardLibraryApi';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  reportInteraction: jest.fn(),
  logInfo: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('../interactions', () => ({
  ...jest.requireActual('../interactions'),
  DashboardLibraryInteractions: {
    ...jest.requireActual('../interactions').DashboardLibraryInteractions,
    communityDashboardFiltered: jest.fn(),
  },
}));
const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;
const mockLogInfo = logInfo as jest.MockedFunction<typeof logInfo>;
const mockLogWarning = logWarning as jest.MockedFunction<typeof logWarning>;

// Helper to create mock BackendSrv
const createMockBackendSrv = (overrides: Partial<BackendSrv> = {}): BackendSrv =>
  ({
    get: jest.fn(),
    ...overrides,
  }) as unknown as BackendSrv;

// Helper functions for creating mock objects
const createMockGnetDashboardSafe = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => {
  return createMockGnetDashboard({ ...overrides });
};

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
    describe('filterNotSafeDashboards', () => {
      it('should filter out dashboards with panel types that can contain JavaScript code', async () => {
        const safeDashboard = createMockGnetDashboardSafe({ id: 1 });
        const mockDashboards = [
          safeDashboard,
          createMockGnetDashboardSafe({ id: 2, panelTypeSlugs: ['ae3e-plotly-panel'] }),
        ];
        const mockResponse = {
          page: 1,
          pages: 5,
          items: mockDashboards,
        };
        mockGet.mockResolvedValue(mockResponse);

        const result = await fetchCommunityDashboards(defaultFetchParams);

        expect(result).toEqual({
          page: 1,
          pages: 5,
          items: [safeDashboard],
        });
      });

      it('should log a warning when a dashboard is filtered out due to unsafe panel types', async () => {
        const unsafeDashboard = createMockGnetDashboardSafe({
          id: 42,
          name: 'Unsafe Dashboard',
          panelTypeSlugs: ['ae3e-plotly-panel'],
        });
        mockGet.mockResolvedValue({ page: 1, pages: 1, items: [unsafeDashboard] });

        await fetchCommunityDashboards(defaultFetchParams);

        expect(mockLogWarning).toHaveBeenCalledWith(
          'Community dashboard filtered out due to unsafe panel types',
          expect.objectContaining({
            dashboardId: '42',
            dashboardName: 'Unsafe Dashboard',
            panelTypes: 'ae3e-plotly-panel',
          })
        );
      });

      it('should log a warning when all dashboards are filtered out', async () => {
        const unsafeDashboard = createMockGnetDashboardSafe({
          id: 1,
          panelTypeSlugs: ['volkovlabs-form-panel'],
        });
        mockGet.mockResolvedValue({ page: 1, pages: 1, items: [unsafeDashboard] });

        await fetchCommunityDashboards({ ...defaultFetchParams, dataSourceSlugIn: 'prometheus' });

        expect(mockLogWarning).toHaveBeenCalledWith('No community dashboards found after safe filtering', {
          dataSourceType: 'prometheus',
          unsafeDashboardsCount: '1',
        });
      });

      it('should not log the "no dashboards found" warning when some dashboards pass filtering', async () => {
        const safeDashboard = createMockGnetDashboardSafe({ id: 1 });
        const unsafeDashboard = createMockGnetDashboardSafe({
          id: 2,
          panelTypeSlugs: ['aceiot-svg-panel'],
        });
        mockGet.mockResolvedValue({ page: 1, pages: 1, items: [safeDashboard, unsafeDashboard] });

        await fetchCommunityDashboards(defaultFetchParams);

        expect(mockLogWarning).not.toHaveBeenCalledWith(
          'No community dashboards found after safe filtering',
          expect.anything()
        );
      });
    });

    it('should fetch community dashboards with correct query parameters', async () => {
      const mockDashboards = [createMockGnetDashboardSafe({ id: 1 }), createMockGnetDashboardSafe({ id: 2 })];
      const mockResponse = {
        page: 1,
        pages: 5,
        items: mockDashboards,
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await fetchCommunityDashboards(defaultFetchParams);

      expect(mockGet).toHaveBeenCalledWith(
        '/api/gnet/dashboards?orderBy=downloads&direction=desc&page=1&pageSize=10&includeLogo=1&includeScreenshots=true&includePanelTypeSlugs=true',
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

    it('should log info with fetch details on successful response', async () => {
      const mockDashboards = [createMockGnetDashboardSafe({ id: 1 }), createMockGnetDashboardSafe({ id: 2 })];
      mockGet.mockResolvedValue({ page: 2, pages: 5, items: mockDashboards });

      await fetchCommunityDashboards({ ...defaultFetchParams, page: 2, dataSourceSlugIn: 'prometheus' });

      expect(mockLogInfo).toHaveBeenCalledWith('Fetched community dashboards', {
        searchParams: expect.stringContaining('page=2'),
        dataSourceType: 'prometheus',
        total: 2,
        page: 2,
        pages: 5,
      });
    });

    it('should not log info when response has unexpected format', async () => {
      mockGet.mockResolvedValue({ page: 1, pages: 1 });

      await fetchCommunityDashboards(defaultFetchParams);

      expect(mockLogInfo).not.toHaveBeenCalled();
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
      const items = [createMockGnetDashboardSafe()];

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

    it('should filter out dashboards that have been removed', async () => {
      const activeDashboard1 = createMockPluginDashboard({ uid: 'active', title: 'Active', removed: false });
      const activeDashboard2 = createMockPluginDashboard({ uid: 'active2', title: 'Active2' });
      const removedDashboard = createMockPluginDashboard({ uid: 'removed', title: 'Removed', removed: true });

      mockGet.mockResolvedValue([activeDashboard1, activeDashboard2, removedDashboard]);

      const result = await fetchProvisionedDashboards('prometheus');

      expect(result).toEqual([activeDashboard1, activeDashboard2]);
    });

    it('should return empty array for datasource with no provisioned dashboards', async () => {
      mockGet.mockResolvedValue([]);

      const result = await fetchProvisionedDashboards('mysql');

      expect(result).toEqual([]);
    });
  });
});
