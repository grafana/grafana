import { Location } from 'history';
import { Subject } from 'rxjs';

import { ScopeDashboardBinding } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
// Import mock data for subScope tests
import { navigationWithSubScope, navigationWithSubScope2, navigationWithSubScopeAndGroups } from '../tests/utils/mocks';

import { ScopesDashboardsService } from './ScopesDashboardsService';
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

      // Set up mock to return items when fetching 'mimir' subScope
      mockApiClient.fetchScopeNavigations.mockImplementation((scopeNames: string[]) => {
        if (scopeNames.includes('mimir')) {
          return Promise.resolve(subScopeItemsWithSameSubScope);
        }
        return Promise.resolve([]);
      });

      // Initial fetch to create the subScope folder
      await service.fetchDashboards(['grafana']);

      // Manually set up the initial navigation to create the folder structure
      const folders = service.groupSuggestedItems([initialNavigation]);
      service.updateState({ folders, filteredFolders: folders });

      // Find the subScope folder key
      const subScopeFolderKey = Object.keys(service.state.folders[''].folders).find(
        (key) => service.state.folders[''].folders[key].subScopeName === 'mimir'
      );

      expect(subScopeFolderKey).toBeDefined();

      // Expand the subScope folder - this should trigger fetchSubScopeItems
      service.updateFolder(['', subScopeFolderKey!], true);

      // Wait for async fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify that the folder was expanded and items were fetched
      const expandedFolder = service.state.folders[''].folders[subScopeFolderKey!];

      // The item with the same subScope should be filtered out
      // Check that we don't have a folder created for the filtered item
      const folderKeys = Object.keys(expandedFolder.folders);
      const hasFilteredItem = folderKeys.some((key) => {
        const folder = expandedFolder.folders[key];
        return folder.subScopeName === 'mimir' && folder.title === 'Mimir Dashboard 2';
      });

      expect(hasFilteredItem).toBe(false);

      // Verify that valid items (without the same subScope) are still present
      // We should have folders for 'General' and 'Observability' groups
      expect(expandedFolder.folders['General']).toBeDefined();
      expect(expandedFolder.folders['Observability']).toBeDefined();
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

      // Set up mock to return items based on subScope being fetched
      mockApiClient.fetchScopeNavigations.mockImplementation((scopeNames: string[]) => {
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

      // Manually set up the initial navigation to create the folder structure
      const folders = service.groupSuggestedItems([grafanaNavigation]);
      service.updateState({ folders, filteredFolders: folders });

      // Find the mimir subScope folder key
      const mimirFolderKey = Object.keys(service.state.folders[''].folders).find(
        (key) => service.state.folders[''].folders[key].subScopeName === 'mimir'
      );

      expect(mimirFolderKey).toBeDefined();

      // Expand the mimir subScope folder
      service.updateFolder(['', mimirFolderKey!], true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Find the loki subScope folder key (should be created from mimir's items)
      const mimirFolder = service.state.folders[''].folders[mimirFolderKey!];
      const lokiFolderKey = Object.keys(mimirFolder.folders).find(
        (key) => mimirFolder.folders[key].subScopeName === 'loki'
      );

      expect(lokiFolderKey).toBeDefined();

      // Expand the loki subScope folder - path is now ['', mimirFolderKey, lokiFolderKey]
      // The path contains 'mimir' subScope, so items with 'mimir' subScope should be filtered out
      service.updateFolder(['', mimirFolderKey!, lokiFolderKey!], true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify that the item with 'mimir' subScope was filtered out
      const lokiFolder = mimirFolder.folders[lokiFolderKey!];
      const hasFilteredItem = Object.keys(lokiFolder.folders).some((key) => {
        const folder = lokiFolder.folders[key];
        return folder.subScopeName === 'mimir' && folder.title === 'Mimir Dashboards Again';
      });

      expect(hasFilteredItem).toBe(false);

      // Verify that valid items are still present
      expect(lokiFolder.folders['General']).toBeDefined();
    });
  });
});
