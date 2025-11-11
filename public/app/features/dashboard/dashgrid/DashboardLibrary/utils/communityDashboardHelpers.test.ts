import { locationService } from '@grafana/runtime';
import { InputType, DataSourceInput, DashboardInput } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { fetchCommunityDashboard } from '../api/dashboardLibraryApi';
import { CONTENT_KINDS, CREATION_ORIGINS, EVENT_LOCATIONS, SOURCE_ENTRY_POINTS } from '../interactions';
import { GnetDashboard } from '../types';

import { InputMapping, tryAutoMapDatasources, parseConstantInputs } from './autoMapDatasources';
import {
  buildDashboardDetails,
  buildGrafanaComUrl,
  createSlug,
  getLogoUrl,
  navigateToTemplate,
  onUseCommunityDashboard,
} from './communityDashboardHelpers';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  locationService: {
    push: jest.fn(),
  },
}));

jest.mock('../api/dashboardLibraryApi', () => ({
  fetchCommunityDashboard: jest.fn(),
}));

jest.mock('./autoMapDatasources', () => ({
  ...jest.requireActual('./autoMapDatasources'),
  tryAutoMapDatasources: jest.fn(),
  parseConstantInputs: jest.fn(),
}));

// Mock function references
const mockFetchCommunityDashboard = fetchCommunityDashboard as jest.MockedFunction<typeof fetchCommunityDashboard>;
const mockTryAutoMapDatasources = tryAutoMapDatasources as jest.MockedFunction<typeof tryAutoMapDatasources>;
const mockParseConstantInputs = parseConstantInputs as jest.MockedFunction<typeof parseConstantInputs>;

// Helper functions for creating mock objects
const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 123,
  uid: 'test-dash-uid',
  name: 'Test Dashboard',
  description: '',
  datasource: 'Prometheus',
  orgName: 'Test Org',
  userName: 'testuser',
  publishedAt: '',
  updatedAt: '2025-11-05T16:55:41.000Z',
  downloads: 0,
  ...overrides,
});

const createMockDashboardJson = (overrides: Partial<DashboardJson> = {}): DashboardJson =>
  ({
    __inputs: [],
    title: 'Test Dashboard',
    panels: [],
    schemaVersion: 41,
    uid: 'test-uid',
    version: 1,
    editable: true,
    graphTooltip: 0,
    timezone: 'browser',
    ...overrides,
  }) as DashboardJson;

describe('communityDashboardHelpers', () => {
  describe('createSlug', () => {
    it('should convert to lower case', () => {
      expect(createSlug('Test')).toBe('test');
    });

    it('should replace non-alphanumeric characters with hyphens', () => {
      expect(createSlug('Test@#example')).toBe('test-example');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(createSlug('-test-')).toBe('test');
    });
  });

  describe('buildGrafanaComUrl', () => {
    it('should build a valid URL', () => {
      const gnetDashboard = createMockGnetDashboard({
        id: 1,
        name: 'Test',
      });

      expect(buildGrafanaComUrl(gnetDashboard)).toBe('https://grafana.com/grafana/dashboards/1-test/');
    });
  });

  describe('buildDashboardDetails', () => {
    it('should build a valid dashboard details object', () => {
      const gnetDashboard = createMockGnetDashboard({
        id: 1,
        name: 'Test',
        datasource: 'Test',
        orgName: 'Org',
        updatedAt: '2025-11-05T16:55:41.000Z',
      });

      const dashboardDetails = {
        id: '1',
        datasource: 'Test',
        dependencies: ['Test'],
        publishedBy: 'Org',
        lastUpdate: '5 Nov 2025',
        grafanaComUrl: 'https://grafana.com/grafana/dashboards/1-test/',
      };

      expect(buildDashboardDetails(gnetDashboard)).toEqual(dashboardDetails);
    });
  });

  describe('getLogoUrl', () => {
    it('should return an empty string if no logo is found', () => {
      const gnetDashboard = createMockGnetDashboard();

      expect(getLogoUrl(gnetDashboard)).toBe('');
    });

    it('should return a valid logo URL', () => {
      const gnetDashboard = createMockGnetDashboard({
        logos: {
          large: {
            content: 'aGVsbG8=',
            type: 'image/png',
            filename: '/dashboards/abc/large_logo/logo.png',
          },
        },
      });

      expect(getLogoUrl(gnetDashboard)).toBe('data:image/png;base64,aGVsbG8=');
    });
  });

  describe('navigateToTemplate', () => {
    it('should navigate to the template route with the correct parameters', () => {
      const dashboardTitle = 'Test Dashboard';
      const gnetId = 123;
      const datasourceUid = 'test-datasource';
      const mappings: InputMapping[] = [];
      const eventLocation = EVENT_LOCATIONS.EMPTY_DASHBOARD;
      const contentKind = CONTENT_KINDS.COMMUNITY_DASHBOARD;

      const mockLocationServicePush = jest.fn();
      locationService.push = mockLocationServicePush;

      navigateToTemplate(dashboardTitle, gnetId, datasourceUid, mappings, eventLocation, contentKind);

      expect(mockLocationServicePush).toHaveBeenCalledWith({
        pathname: DASHBOARD_LIBRARY_ROUTES.Template,
        search: expect.any(String),
      });

      const callArgs = mockLocationServicePush.mock.calls[0][0];
      const searchParams = new URLSearchParams(callArgs.search);

      expect(searchParams.get('title')).toBe('Test Dashboard');
      expect(searchParams.get('gnetId')).toBe('123');
      expect(searchParams.get('datasource')).toBe('test-datasource');
      expect(searchParams.get('sourceEntryPoint')).toBe(SOURCE_ENTRY_POINTS.DATASOURCE_PAGE);
      expect(searchParams.get('creationOrigin')).toBe(CREATION_ORIGINS.DASHBOARD_LIBRARY_COMMUNITY_DASHBOARD);
      expect(searchParams.get('contentKind')).toBe(CONTENT_KINDS.COMMUNITY_DASHBOARD);
      expect(searchParams.get('eventLocation')).toBe(EVENT_LOCATIONS.EMPTY_DASHBOARD);
      expect(searchParams.get('mappings')).toBe('[]');
    });
  });

  describe('onUseCommunityDashboard', () => {
    async function setup(options?: {
      dashboard?: Partial<GnetDashboard>;
      dashboardJson?: Partial<DashboardJson>;
      autoMapResult?: {
        allMapped: boolean;
        mappings: InputMapping[];
        unmappedDsInputs: DataSourceInput[];
      };
      constantInputs?: DashboardInput[];
      onShowMapping?: jest.Mock;
    }) {
      const dashboard = createMockGnetDashboard(options?.dashboard);
      const dashboardJson = createMockDashboardJson(options?.dashboardJson);

      mockFetchCommunityDashboard.mockResolvedValue({ json: dashboardJson });

      mockTryAutoMapDatasources.mockReturnValue(
        options?.autoMapResult ?? {
          allMapped: true,
          mappings: [],
          unmappedDsInputs: [],
        }
      );

      mockParseConstantInputs.mockReturnValue(options?.constantInputs ?? []);

      await onUseCommunityDashboard({
        dashboard,
        datasourceUid: 'test-ds-uid',
        datasourceType: 'prometheus',
        eventLocation: 'empty_dashboard',
        onShowMapping: options?.onShowMapping,
      });
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should navigate directly when all datasources are auto-mapped and no constants', async () => {
      await setup({
        autoMapResult: {
          allMapped: true,
          mappings: [{ name: 'DS_PROM', type: 'datasource', value: 'prom-uid', pluginId: 'prometheus' }],
          unmappedDsInputs: [],
        },
      });

      expect(locationService.push).toHaveBeenCalled();
      expect(locationService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: expect.any(String),
          search: expect.stringContaining('gnetId=123'),
        })
      );
    });

    it('should show mapping form when datasources are unmapped', async () => {
      const mockOnShowMapping = jest.fn();

      await setup({
        autoMapResult: {
          allMapped: false,
          mappings: [],
          unmappedDsInputs: [
            {
              name: 'DS_PROM',
              pluginId: 'prometheus',
              type: InputType.DataSource,
              info: 'prometheus',
              value: '',
              label: 'Prometheus',
            },
          ],
        },
        onShowMapping: mockOnShowMapping,
      });

      expect(mockOnShowMapping).toHaveBeenCalled();
      expect(locationService.push).not.toHaveBeenCalled();
      expect(mockOnShowMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboardName: 'Test Dashboard',
          unmappedDsInputs: expect.arrayContaining([expect.objectContaining({ name: 'DS_PROM' })]),
        })
      );
    });

    it('should show mapping form when constants exist even if datasources are mapped', async () => {
      const mockOnShowMapping = jest.fn();

      await setup({
        autoMapResult: {
          allMapped: true,
          mappings: [{ name: 'DS_PROM', type: 'datasource', value: 'prom-uid', pluginId: 'prometheus' }],
          unmappedDsInputs: [],
        },
        constantInputs: [
          {
            name: 'var_instance',
            label: 'Instance',
            description: 'Instance name',
            info: 'Enter instance name',
            value: 'default',
            type: InputType.Constant,
          },
        ],
        onShowMapping: mockOnShowMapping,
      });

      expect(mockOnShowMapping).toHaveBeenCalled();
      expect(locationService.push).not.toHaveBeenCalled();
      expect(mockOnShowMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboardName: 'Test Dashboard',
          constantInputs: expect.arrayContaining([expect.objectContaining({ name: 'var_instance' })]),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchCommunityDashboard.mockRejectedValue(new Error('API failed'));

      await onUseCommunityDashboard({
        dashboard: createMockGnetDashboard(),
        datasourceUid: 'test-ds-uid',
        datasourceType: 'prometheus',
        eventLocation: 'empty_dashboard',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
      expect(locationService.push).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
