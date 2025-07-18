import { Location } from 'history';

import { ScopeDashboardBinding } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';

import { ScopesDashboardsService } from './ScopesDashboardsService';
import { ScopeNavigation } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      useScopesNavigationEndpoint: false,
    },
  },
  locationService: {
    getLocation: jest.fn(),
  },
}));

describe('ScopesDashboardsService', () => {
  let service: ScopesDashboardsService;
  let mockApiClient: jest.Mocked<ScopesApiClient>;

  beforeEach(() => {
    mockApiClient = {
      fetchDashboards: jest.fn(),
      fetchScopeNavigations: jest.fn(),
    } as unknown as jest.Mocked<ScopesApiClient>;

    service = new ScopesDashboardsService(mockApiClient);
  });

  describe('folder expansion based on location', () => {
    it('should expand folders when current location matches dashboard ID', async () => {
      // Mock current location to be a dashboard
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/d/dashboard1' } as Location);

      const mockDashboards: ScopeDashboardBinding[] = [
        {
          spec: {
            scope: 'scope1',
            dashboard: 'dashboard1',
          },
          status: {
            dashboardTitle: 'Test Dashboard',
            groups: ['group1'],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ];

      mockApiClient.fetchDashboards.mockResolvedValue(mockDashboards);
      await service.fetchDashboards(['scope1']);

      // Verify that the folder is expanded because the current dashboard ID matches
      expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
    });

    it('should expand folders when current location matches URL path and navigation endpoint is enabled', async () => {
      // Enable the navigation endpoint feature toggle
      config.featureToggles.useScopesNavigationEndpoint = true;

      // Mock current location to match a URL-based navigation
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/test-url' } as Location);

      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'scope1',
            url: '/test-url',
          },
          status: {
            title: 'Test URL',
            groups: ['group1'],
          },
          metadata: {
            name: 'url1',
          },
        },
      ];

      mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);
      await service.fetchDashboards(['scope1']);

      // Verify that the folder is expanded because the current URL path matches
      expect(service.state.folders[''].folders['group1'].expanded).toBe(true);

      // Reset the feature toggle
      config.featureToggles.useScopesNavigationEndpoint = false;
    });

    it('should not expand folders when current location does not match any navigation', async () => {
      // Mock current location to not match any navigation
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/different-path' } as Location);

      const mockDashboards: ScopeDashboardBinding[] = [
        {
          spec: {
            scope: 'scope1',
            dashboard: 'dashboard1',
          },
          status: {
            dashboardTitle: 'Test Dashboard',
            groups: ['group1'],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ];

      mockApiClient.fetchDashboards.mockResolvedValue(mockDashboards);
      await service.fetchDashboards(['scope1']);

      // Verify that the folder is not expanded because the current location doesn't match
      expect(service.state.folders[''].folders['group1'].expanded).toBe(false);
    });

    it('should expand folders when current location matches nested dashboard path', async () => {
      // Mock current location to be a nested dashboard path
      (locationService.getLocation as jest.Mock).mockReturnValue({
        pathname: '/d/dashboard1/very-important',
      } as Location);

      const mockDashboards: ScopeDashboardBinding[] = [
        {
          spec: {
            scope: 'scope1',
            dashboard: 'dashboard1',
          },
          status: {
            dashboardTitle: 'Test Dashboard',
            groups: ['group1'],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ];

      mockApiClient.fetchDashboards.mockResolvedValue(mockDashboards);
      await service.fetchDashboards(['scope1']);

      // Verify that the folder is expanded because the current path starts with the dashboard ID
      expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
    });

    it('should not expand folders containing different dashboards', async () => {
      // Mock current location to be a specific dashboard
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/d/dashboard1' } as Location);

      const mockDashboards: ScopeDashboardBinding[] = [
        {
          spec: {
            scope: 'scope1',
            dashboard: 'dashboard1',
          },
          status: {
            dashboardTitle: 'Test Dashboard',
            groups: ['group1'],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
        {
          spec: {
            scope: 'scope1',
            dashboard: 'dashboard2',
          },
          status: {
            dashboardTitle: 'Another Dashboard',
            groups: ['group2'],
          },
          metadata: {
            name: 'dashboard2',
          },
        },
      ];

      mockApiClient.fetchDashboards.mockResolvedValue(mockDashboards);
      await service.fetchDashboards(['scope1']);

      // Verify that only the folder containing the current dashboard is expanded
      expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
      expect(service.state.folders[''].folders['group2'].expanded).toBe(false);
    });

    describe('with useScopesNavigationEndpoint enabled', () => {
      beforeEach(() => {
        config.featureToggles.useScopesNavigationEndpoint = true;
      });

      afterEach(() => {
        config.featureToggles.useScopesNavigationEndpoint = false;
      });

      it('should expand folders when current location matches a navigation URL', async () => {
        // Mock current location to match a navigation URL
        (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/custom-page' } as Location);

        const mockNavigations: ScopeNavigation[] = [
          {
            spec: {
              scope: 'scope1',
              url: '/custom-page',
            },
            status: {
              title: 'Custom Page',
              groups: ['group1'],
            },
            metadata: {
              name: 'nav1',
            },
          },
        ];

        mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);
        await service.fetchDashboards(['scope1']);

        // Verify that the folder is expanded because the current URL matches a navigation
        expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
      });

      it('should expand folders when current location matches a nested navigation URL', async () => {
        // Mock current location to match a nested navigation URL
        (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/custom-page/details' } as Location);

        const mockNavigations: ScopeNavigation[] = [
          {
            spec: {
              scope: 'scope1',
              url: '/custom-page',
            },
            status: {
              title: 'Custom Page',
              groups: ['group1'],
            },
            metadata: {
              name: 'nav1',
            },
          },
        ];

        mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);
        await service.fetchDashboards(['scope1']);

        // Verify that the folder is expanded because the current URL starts with a navigation URL
        expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
      });

      it('should not expand folders when current location does not match any navigation', async () => {
        // Mock current location to not match any navigation
        (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/unrelated-page' } as Location);

        const mockNavigations: ScopeNavigation[] = [
          {
            spec: {
              scope: 'scope1',
              url: '/custom-page',
            },
            status: {
              title: 'Custom Page',
              groups: ['group1'],
            },
            metadata: {
              name: 'nav1',
            },
          },
        ];

        mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);
        await service.fetchDashboards(['scope1']);

        // Verify that the folder is not expanded because the current URL doesn't match any navigation
        expect(service.state.folders[''].folders['group1'].expanded).toBe(false);
      });

      it('should not expand folders containing different navigations', async () => {
        // Mock current location to match a specific navigation
        (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/custom-page' } as Location);

        const mockNavigations: ScopeNavigation[] = [
          {
            spec: {
              scope: 'scope1',
              url: '/custom-page',
            },
            status: {
              title: 'Custom Page',
              groups: ['group1'],
            },
            metadata: {
              name: 'nav1',
            },
          },
          {
            spec: {
              scope: 'scope1',
              url: '/other-page',
            },
            status: {
              title: 'Other Page',
              groups: ['group2'],
            },
            metadata: {
              name: 'nav2',
            },
          },
        ];

        mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);
        await service.fetchDashboards(['scope1']);

        // Verify that only the folder containing the current navigation is expanded
        expect(service.state.folders[''].folders['group1'].expanded).toBe(true);
        expect(service.state.folders[''].folders['group2'].expanded).toBe(false);
      });
    });
  });
});
