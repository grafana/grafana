import { Location } from 'history';
import { Subject } from 'rxjs';

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
    // Mock getLocationObservable to return a mock observable
    getLocationObservable: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
    }),
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

    it('should expand folder when location changes and matches a navigation URL', async () => {
      config.featureToggles.useScopesNavigationEndpoint = true;

      // Mock initial location
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/' } as Location);

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

      // Set up mock observable to emit location changes
      const locationSubject = new Subject<Location>();
      (locationService.getLocationObservable as jest.Mock).mockReturnValue(locationSubject);

      // Create a new service instance that will subscribe to our mocked observable
      const testService = new ScopesDashboardsService(mockApiClient);
      await testService.fetchDashboards(['scope1']);

      // Initially, folder should not be expanded since we're at '/'
      expect(testService.state.folders[''].folders['group1'].expanded).toBe(false);

      // Simulate location change to a URL that matches a navigation
      locationSubject.next({ pathname: '/test-url' } as Location);

      // Now the folder should be expanded because the location matches a navigation URL
      expect(testService.state.folders[''].folders['group1'].expanded).toBe(true);

      // Reset the feature toggle
      config.featureToggles.useScopesNavigationEndpoint = false;
    });

    it('should not expand folder when location changes, matches a navigation URL in a folder which is already expanded', async () => {
      config.featureToggles.useScopesNavigationEndpoint = true;

      // Mock initial location
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/' } as Location);

      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'scope1',
            url: '/test-url',
          },
          status: {
            title: 'Test URL',
            groups: ['group1', 'group2'],
          },
          metadata: {
            name: 'url1',
          },
        },
      ];

      mockApiClient.fetchScopeNavigations.mockResolvedValue(mockNavigations);

      // Set up mock observable to emit location changes
      const locationSubject = new Subject<Location>();
      (locationService.getLocationObservable as jest.Mock).mockReturnValue(locationSubject);

      // Create a new service instance that will subscribe to our mocked observable
      const testService = new ScopesDashboardsService(mockApiClient);
      await testService.fetchDashboards(['scope1']);

      // Initially, folder should not be expanded since we're at '/'
      expect(testService.state.folders[''].folders['group1'].expanded).toBe(false);

      // Manually expand group1 to simulate it being already expanded
      testService.updateFolder(['', 'group2'], true);
      expect(testService.state.folders[''].folders['group2'].expanded).toBe(true);

      // Simulate location change to a URL that matches a navigation
      locationSubject.next({ pathname: '/test-url' } as Location);

      // The folder should still be expanded (no change since it was already expanded)
      expect(testService.state.folders[''].folders['group1'].expanded).toBe(false);
      expect(testService.state.folders[''].folders['group2'].expanded).toBe(true);

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
