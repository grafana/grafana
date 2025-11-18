import { Location } from 'history';
import { Subject } from 'rxjs';

import { ScopeDashboardBinding } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
// Import mock data for subScope tests
import { navigationWithSubScope, navigationWithSubScope2, navigationWithSubScopeAndGroups } from '../tests/utils/mocks';

import { ScopesDashboardsService, filterItemsWithSubScopesInPath } from './ScopesDashboardsService';
import { ScopeNavigation } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      useScopesNavigationEndpoint: false,
    },
    apps: {},
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

  describe('groupSuggestedItems with subScopes', () => {
    it('Creates subScope folders for items with subScope', () => {
      const result = service.groupSuggestedItems([navigationWithSubScope]);

      expect(result[''].folders).toHaveProperty('mimir-subscope-nav-1');
      expect(result[''].folders['mimir-subscope-nav-1']).toEqual({
        title: 'Mimir Dashboards',
        expanded: false,
        folders: {},
        suggestedNavigations: {},
        subScopeName: 'mimir',
      });
    });

    it('Creates separate folders for multiple items with same subScope', () => {
      const result = service.groupSuggestedItems([navigationWithSubScope, navigationWithSubScope2]);

      // Should create separate folders
      expect(result[''].folders).toHaveProperty('mimir-subscope-nav-1');
      expect(result[''].folders).toHaveProperty('mimir-subscope-nav-2');

      // Both should reference the same subScope
      expect(result[''].folders['mimir-subscope-nav-1'].subScopeName).toBe('mimir');
      expect(result[''].folders['mimir-subscope-nav-2'].subScopeName).toBe('mimir');
    });

    it('Ignores groups for subScope items', () => {
      const result = service.groupSuggestedItems([navigationWithSubScopeAndGroups]);

      // Should create folder, not add to group folders
      expect(result[''].folders).toHaveProperty('mimir-subscope-nav-groups');
      expect(result[''].folders['mimir-subscope-nav-groups'].subScopeName).toBe('mimir');

      // Should not add to any group folders
      expect(Object.keys(result[''].folders).length).toBe(1);
      expect(result[''].suggestedNavigations).toEqual({});
    });

    it('Does not add navigation items for subScope entries', () => {
      const result = service.groupSuggestedItems([navigationWithSubScope]);

      // Should only create folder, not add navigation item
      expect(result[''].folders['mimir-subscope-nav-1'].suggestedNavigations).toEqual({});
      expect(result[''].suggestedNavigations).toEqual({});
    });

    it('Mixes subScope and regular items correctly', () => {
      const regularItem: ScopeNavigation = {
        metadata: { name: 'regular-nav' },
        spec: {
          scope: 'grafana',
          url: '/d/regular-dashboard',
        },
        status: {
          title: 'Regular Dashboard',
          groups: ['General'],
        },
      };

      const result = service.groupSuggestedItems([navigationWithSubScope, regularItem]);

      // Should have subScope folder
      expect(result[''].folders).toHaveProperty('mimir-subscope-nav-1');
      expect(result[''].folders['mimir-subscope-nav-1'].subScopeName).toBe('mimir');

      // Should have regular group folder
      expect(result[''].folders).toHaveProperty('General');
      expect(result[''].folders['General'].subScopeName).toBeUndefined();

      // Regular item should be in group folder
      expect(result[''].folders['General'].suggestedNavigations).toHaveProperty('/d/regular-dashboard');
    });
  });

  describe('fetchSubScopeItems infinite loop prevention', () => {
    beforeEach(() => {
      config.featureToggles.useScopesNavigationEndpoint = true;
    });

    afterEach(() => {
      config.featureToggles.useScopesNavigationEndpoint = false;
    });

    it('should filter out items with subScope matching any subScope in the path', async () => {
      // Mock current location
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/' } as Location);

      // Create initial navigation with subScope 'mimir'
      const initialNavigation: ScopeNavigation = {
        metadata: { name: 'subscope-nav-1' },
        spec: {
          scope: 'grafana',
          subScope: 'mimir',
          url: '/d/mimir-dashboards',
        },
        status: {
          title: 'Mimir Dashboards',
        },
      };

      // Mock items returned when fetching 'mimir' subScope
      // One of them has the same subScope 'mimir', which should be filtered out
      const subScopeItemsWithSameSubScope: ScopeNavigation[] = [
        {
          metadata: { name: 'mimir-item-1' },
          spec: {
            scope: 'mimir',
            url: '/d/mimir-dashboard-1',
          },
          status: {
            title: 'Mimir Dashboard 1',
            groups: ['General'],
          },
        },
        {
          metadata: { name: 'mimir-item-2' },
          spec: {
            scope: 'mimir',
            subScope: 'mimir', // This should be filtered out - same subScope as in path
            url: '/d/mimir-dashboard-2',
          },
          status: {
            title: 'Mimir Dashboard 2',
          },
        },
        {
          metadata: { name: 'mimir-item-3' },
          spec: {
            scope: 'mimir',
            url: '/d/mimir-dashboard-3',
          },
          status: {
            title: 'Mimir Dashboard 3',
            groups: ['Observability'],
          },
        },
      ];

      // Set up mock to return items based on scope being fetched
      mockApiClient.fetchScopeNavigations.mockImplementation((scopeNames: string[]) => {
        if (scopeNames.includes('grafana')) {
          return Promise.resolve([initialNavigation]);
        }
        if (scopeNames.includes('mimir')) {
          return Promise.resolve(subScopeItemsWithSameSubScope);
        }
        return Promise.resolve([]);
      });

      // Initial fetch to create the subScope folder
      await service.fetchDashboards(['grafana']);

      // The folder key is based on the pattern: ${subScope}-${metadata.name}
      const subScopeFolderKey = 'mimir-subscope-nav-1';

      // Test the filtering logic directly
      const filteredItems = filterItemsWithSubScopesInPath(
        subScopeItemsWithSameSubScope,
        ['', subScopeFolderKey],
        'mimir',
        service.state.folders
      );

      // Verify that the item with the same subScope was filtered out
      const hasFilteredItem = filteredItems.some(
        (item) => 'subScope' in item.spec && item.spec.subScope === 'mimir' && item.metadata.name === 'mimir-item-2'
      );
      expect(hasFilteredItem).toBe(false);

      // Verify that valid items are still present
      expect(filteredItems.length).toBe(2); // Should have 2 items (mimir-item-1 and mimir-item-3)
      expect(filteredItems.some((item) => item.metadata.name === 'mimir-item-1')).toBe(true);
      expect(filteredItems.some((item) => item.metadata.name === 'mimir-item-3')).toBe(true);
    });

    it('should filter out items with subScope matching nested subScope in the path', async () => {
      // Mock current location
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/' } as Location);

      // Create nested subScope structure: grafana -> mimir -> loki
      const grafanaNavigation: ScopeNavigation = {
        metadata: { name: 'mimir-nav' },
        spec: {
          scope: 'grafana',
          subScope: 'mimir',
          url: '/d/mimir-dashboards',
        },
        status: {
          title: 'Mimir Dashboards',
        },
      };

      // Mock items returned when fetching 'mimir' subScope
      // One of them has subScope 'loki', which is fine
      const mimirSubScopeItems: ScopeNavigation[] = [
        {
          metadata: { name: 'mimir-item-1' },
          spec: {
            scope: 'mimir',
            url: '/d/mimir-dashboard-1',
          },
          status: {
            title: 'Mimir Dashboard 1',
            groups: ['General'],
          },
        },
        {
          metadata: { name: 'loki-nav' },
          spec: {
            scope: 'mimir',
            subScope: 'loki', // This is fine - different subScope
            url: '/d/loki-dashboards',
          },
          status: {
            title: 'Loki Dashboards',
          },
        },
      ];

      // Mock items returned when fetching 'loki' subScope
      // One of them has subScope 'mimir', which should be filtered out since 'mimir' is already in the path
      const lokiSubScopeItems: ScopeNavigation[] = [
        {
          metadata: { name: 'loki-item-1' },
          spec: {
            scope: 'loki',
            url: '/d/loki-dashboard-1',
          },
          status: {
            title: 'Loki Dashboard 1',
            groups: ['General'],
          },
        },
        {
          metadata: { name: 'mimir-nav-again' },
          spec: {
            scope: 'loki',
            subScope: 'mimir', // This should be filtered out - 'mimir' is already in the path
            url: '/d/mimir-dashboards-again',
          },
          status: {
            title: 'Mimir Dashboards Again',
          },
        },
      ];

      // Set up mock to return items based on scope being fetched
      mockApiClient.fetchScopeNavigations.mockImplementation((scopeNames: string[]) => {
        if (scopeNames.includes('grafana')) {
          return Promise.resolve([grafanaNavigation]);
        }
        if (scopeNames.includes('mimir')) {
          return Promise.resolve(mimirSubScopeItems);
        }
        if (scopeNames.includes('loki')) {
          return Promise.resolve(lokiSubScopeItems);
        }
        return Promise.resolve([]);
      });

      // Initial fetch to create the first subScope folder
      await service.fetchDashboards(['grafana']);

      // Set up the folder structure to simulate nested path
      const folders = service.groupSuggestedItems([grafanaNavigation]);
      const mimirFolders = service.groupSuggestedItems(mimirSubScopeItems);

      // Manually construct the nested folder structure for testing
      const testFolders: typeof service.state.folders = {
        '': {
          ...folders[''],
          folders: {
            ...folders[''].folders,
            'mimir-mimir-nav': {
              ...folders[''].folders['mimir-mimir-nav'],
              folders: {
                ...mimirFolders[''].folders,
              },
            },
          },
        },
      };

      // Test the filtering logic for nested path
      const filteredItems = filterItemsWithSubScopesInPath(
        lokiSubScopeItems,
        ['', 'mimir-mimir-nav', 'loki-loki-nav'],
        'loki',
        testFolders
      );

      // Verify that the item with 'mimir' subScope was filtered out
      const hasFilteredItem = filteredItems.some(
        (item) => 'subScope' in item.spec && item.spec.subScope === 'mimir' && item.metadata.name === 'mimir-nav-again'
      );

      expect(hasFilteredItem).toBe(false);

      // Verify that valid items are still present
      expect(filteredItems.length).toBe(1); // Should have 1 item (loki-item-1)
      expect(filteredItems.some((item) => item.metadata.name === 'loki-item-1')).toBe(true);
    });
  });
});
