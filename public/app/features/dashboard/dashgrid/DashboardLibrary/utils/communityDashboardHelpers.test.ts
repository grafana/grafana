import { BackendSrv, getBackendSrv, locationService } from '@grafana/runtime';
import { InputType, DataSourceInput, DashboardInput, DashboardJson } from 'app/features/manage-dashboards/types';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { fetchCommunityDashboard } from '../api/dashboardLibraryApi';
import { CONTENT_KINDS, CREATION_ORIGINS, EVENT_LOCATIONS, SOURCE_ENTRY_POINTS } from '../interactions';
import { GnetDashboard } from '../types';

import { InputMapping, tryAutoMapDatasources, parseConstantInputs } from './autoMapDatasources';
import {
  buildDashboardDetails,
  buildGrafanaComUrl,
  getLogoUrl,
  navigateToTemplate,
  onUseCommunityDashboard,
  interpolateDashboardForCompatibilityCheck,
} from './communityDashboardHelpers';

jest.mock('../api/dashboardLibraryApi', () => ({
  fetchCommunityDashboard: jest.fn(),
}));

jest.mock('./autoMapDatasources', () => ({
  ...jest.requireActual('./autoMapDatasources'),
  tryAutoMapDatasources: jest.fn(),
  parseConstantInputs: jest.fn(),
}));

jest.mock('../interactions', () => ({
  ...jest.requireActual('../interactions'),
  DashboardLibraryInteractions: {
    ...jest.requireActual('../interactions').DashboardLibraryInteractions,
    communityDashboardFiltered: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  locationService: {
    push: jest.fn(),
  },
}));

// Mock function references
const mockFetchCommunityDashboard = fetchCommunityDashboard as jest.MockedFunction<typeof fetchCommunityDashboard>;
const mockTryAutoMapDatasources = tryAutoMapDatasources as jest.MockedFunction<typeof tryAutoMapDatasources>;
const mockParseConstantInputs = parseConstantInputs as jest.MockedFunction<typeof parseConstantInputs>;
const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;

// Helper functions for creating mock objects
const createMockBackendSrv = (overrides: Partial<BackendSrv> = {}): BackendSrv =>
  ({
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    request: jest.fn(),
    datasourceRequest: jest.fn(),
    resolveCancelerIfExists: jest.fn(),
    ...overrides,
  }) as BackendSrv;

const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 123,
  name: 'Test Dashboard',
  description: '',
  datasource: 'Prometheus',
  orgName: 'Test Org',
  userName: 'testuser',
  publishedAt: '',
  updatedAt: '2025-11-05T16:55:41.000Z',
  downloads: 0,
  slug: 'test-dashboard',
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
  describe('buildGrafanaComUrl', () => {
    it('should build a valid URL', () => {
      const gnetDashboard = createMockGnetDashboard({
        id: 1,
        slug: 'test',
      });

      expect(buildGrafanaComUrl(gnetDashboard)).toBe('https://grafana.com/grafana/dashboards/1-test/');
    });
  });

  describe('buildDashboardDetails', () => {
    it('should build a valid dashboard details object', () => {
      const gnetDashboard = createMockGnetDashboard({
        id: 1,
        name: 'Test',
        slug: 'test',
        datasource: 'Test',
        orgName: 'Org',
        updatedAt: '2025-11-05T16:55:41.000Z',
      });

      const result = buildDashboardDetails(gnetDashboard);

      expect(result).toEqual({
        id: '1',
        datasource: 'Test',
        dependencies: ['Test'],
        publishedBy: 'Org',
        lastUpdate: expect.any(String), // Date format varies by locale
        grafanaComUrl: 'https://grafana.com/grafana/dashboards/1-test/',
      });

      // Verify the date was formatted (not the raw ISO string)
      expect(result.lastUpdate).not.toBe('2025-11-05T16:55:41.000Z');
      expect(result.lastUpdate).toContain('2025');
      expect(result.lastUpdate).toMatch(/Nov/);
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
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let locationServicePushSpy: jest.SpyInstance;

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
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      locationServicePushSpy = jest.spyOn(locationService, 'push').mockImplementation();
    });

    afterEach(() => {
      jest.clearAllMocks();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      locationServicePushSpy.mockRestore();
    });

    it('should navigate directly when all datasources are auto-mapped and no constants', async () => {
      await setup({
        autoMapResult: {
          allMapped: true,
          mappings: [{ name: 'DS_PROM', type: 'datasource', value: 'prom-uid', pluginId: 'prometheus' }],
          unmappedDsInputs: [],
        },
      });

      expect(locationServicePushSpy).toHaveBeenCalled();
      expect(locationServicePushSpy).toHaveBeenCalledWith(
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
      expect(locationServicePushSpy).not.toHaveBeenCalled();
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
      expect(locationServicePushSpy).not.toHaveBeenCalled();
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

      await expect(
        onUseCommunityDashboard({
          dashboard: createMockGnetDashboard(),
          datasourceUid: 'test-ds-uid',
          datasourceType: 'prometheus',
          eventLocation: 'empty_dashboard',
        })
      ).rejects.toThrow('API failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
      expect(locationServicePushSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    describe('when the dashboard contains JavaScript code', () => {
      it('should throw an error if the dashboard contains JavaScript code in options', async () => {
        const dashboardJson = createMockDashboardJson({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          panels: [{ type: 'panel', options: { template: '{{ javascript:alert("XSS") }}' } } as any],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains JavaScript code in targets/queries', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              targets: [
                {
                  expr: 'function() { return bad(); }',
                  refId: 'A',
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains JavaScript code in transformations', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              transformations: [
                {
                  id: 'calculateField',
                  options: {
                    mode: 'binary',
                    binary: {
                      reducer: 'sum',
                      left: 'A',
                      right: 'B',
                    },
                    replaceFields: false,
                    alias: 'function() { alert("XSS"); }',
                  },
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains JavaScript code in fieldConfig', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              fieldConfig: {
                defaults: {
                  custom: {
                    displayMode: 'function() { return "bad"; }',
                  },
                },
                overrides: [],
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains javascript: URLs in links', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              links: [
                {
                  title: 'Bad Link',
                  url: 'javascript:alert("XSS")',
                  targetBlank: false,
                },
              ],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains <script> tags in any property', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {
                content: '<script>alert("XSS")</script>',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains arrow functions', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {
                customCode: '() => { alert("XSS"); }',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains setTimeout or setInterval', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {
                handler: 'setTimeout(() => alert("XSS"), 1000)',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains suspicious key names like beforeRender', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              beforeRender: 'alert("XSS")',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains suspicious key names like afterRender', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              afterRender: 'alert("XSS")',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains suspicious key names like handler', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {},
              handler: 'alert("XSS")',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains return statements', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {
                customLogic: 'function test() { return malicious(); }',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });

      it('should throw an error if the dashboard contains event handlers like onclick', async () => {
        const dashboardJson = createMockDashboardJson({
          panels: [
            {
              type: 'panel',
              options: {
                html: '<div onclick="alert(\'XSS\')">Click me</div>',
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          ],
        });

        await expect(setup({ dashboardJson })).rejects.toThrow(
          'Community dashboard 123 "Test Dashboard" might contain JavaScript code'
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading community dashboard:', expect.any(Error));
        expect(locationServicePushSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('interpolateDashboardForCompatibilityCheck', () => {
    let mockPost: jest.Mock;

    beforeEach(() => {
      mockPost = jest.fn();
      mockGetBackendSrv.mockReturnValue(createMockBackendSrv({ post: mockPost }));
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully interpolate dashboard when auto-mapping succeeds', async () => {
      const dashboardJson = createMockDashboardJson({
        __inputs: [
          {
            name: 'DS_PROMETHEUS',
            type: InputType.DataSource,
            label: 'Prometheus',
            value: '',
            description: '',
            pluginId: 'prometheus',
            info: '',
          } as DataSourceInput & { description: string },
        ],
      });

      const interpolatedDashboard = createMockDashboardJson({ title: 'Interpolated Dashboard' });

      mockFetchCommunityDashboard.mockResolvedValue({ json: dashboardJson });
      mockTryAutoMapDatasources.mockReturnValue({
        allMapped: true,
        mappings: [{ name: 'DS_PROMETHEUS', type: 'datasource', value: 'prom-uid', pluginId: 'prometheus' }],
        unmappedDsInputs: [],
      });
      mockPost.mockResolvedValue(interpolatedDashboard);

      const result = await interpolateDashboardForCompatibilityCheck(123, 'prom-uid');

      expect(result).toEqual(interpolatedDashboard);
      expect(mockFetchCommunityDashboard).toHaveBeenCalledWith(123);
      expect(mockTryAutoMapDatasources).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalledWith('/api/dashboards/interpolate', {
        dashboard: dashboardJson,
        overwrite: true,
        inputs: [{ name: 'DS_PROMETHEUS', type: 'datasource', value: 'prom-uid', pluginId: 'prometheus' }],
      });
    });

    it('should throw error when auto-mapping fails', async () => {
      const dashboardJson = createMockDashboardJson({
        __inputs: [
          {
            name: 'DS_PROMETHEUS',
            type: InputType.DataSource,
            label: 'Prometheus',
            value: '',
            description: '',
            pluginId: 'prometheus',
            info: '',
          } as DataSourceInput & { description: string },
        ],
      });

      mockFetchCommunityDashboard.mockResolvedValue({ json: dashboardJson });
      mockTryAutoMapDatasources.mockReturnValue({
        allMapped: false,
        mappings: [],
        unmappedDsInputs: [
          {
            name: 'DS_PROMETHEUS',
            pluginId: 'prometheus',
            type: InputType.DataSource,
            value: '',
            label: 'Prometheus',
            description: '',
            info: '',
          },
        ],
      });

      await expect(interpolateDashboardForCompatibilityCheck(123, 'prom-uid')).rejects.toThrow(
        'Unable to automatically map all datasource inputs for this dashboard'
      );

      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should throw error when interpolation API fails', async () => {
      const dashboardJson = createMockDashboardJson();

      mockFetchCommunityDashboard.mockResolvedValue({ json: dashboardJson });
      mockTryAutoMapDatasources.mockReturnValue({
        allMapped: true,
        mappings: [],
        unmappedDsInputs: [],
      });
      mockPost.mockRejectedValue(new Error('API failed'));

      await expect(interpolateDashboardForCompatibilityCheck(123, 'prom-uid')).rejects.toThrow('API failed');
    });

    it('should handle dashboard with no __inputs', async () => {
      const dashboardJson = createMockDashboardJson({ __inputs: undefined });
      const interpolatedDashboard = createMockDashboardJson({ title: 'Interpolated Dashboard' });

      mockFetchCommunityDashboard.mockResolvedValue({ json: dashboardJson });
      mockTryAutoMapDatasources.mockReturnValue({
        allMapped: true,
        mappings: [],
        unmappedDsInputs: [],
      });
      mockPost.mockResolvedValue(interpolatedDashboard);

      const result = await interpolateDashboardForCompatibilityCheck(123, 'prom-uid');

      expect(result).toEqual(interpolatedDashboard);
      expect(mockTryAutoMapDatasources).toHaveBeenCalledWith([], 'prom-uid');
    });
  });
});
