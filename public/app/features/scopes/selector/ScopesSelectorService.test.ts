import { Scope, ScopeNode, Store } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';
import { ScopeNavigation } from '../dashboards/types';

import { RECENT_SCOPES_KEY, ScopesSelectorService } from './ScopesSelectorService';
import { RecentScope } from './types';

// Mock locationService
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getLocation: jest.fn(),
  },
}));

describe('ScopesSelectorService', () => {
  let service: ScopesSelectorService;
  let apiClient: jest.Mocked<ScopesApiClient>;
  let dashboardsService: jest.Mocked<ScopesDashboardsService>;

  const mockScope: Scope = {
    metadata: {
      name: 'test-scope',
    },
    spec: {
      title: 'test-scope',
      filters: [],
    },
  };

  const mockScope2: Scope = {
    metadata: {
      name: 'recent-scope',
    },
    spec: {
      title: 'test-scope',
      filters: [],
    },
  };

  const mockNode: ScopeNode = {
    metadata: { name: 'test-scope-node' },
    spec: { linkId: 'test-scope', linkType: 'scope', parentName: '', nodeType: 'leaf', title: 'test-scope-node' },
  };

  let storeValue: Record<string, unknown> = {};
  let store: Store;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock locationService to return a default location
    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-page' });

    apiClient = {
      fetchScope: jest.fn().mockResolvedValue(mockScope),
      fetchMultipleScopes: jest.fn().mockResolvedValue([mockScope]),
      fetchNodes: jest.fn().mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
        if (options.parent === '' && !options.query) {
          return [mockNode];
        } else {
          return [];
        }
      }),
      fetchDashboards: jest.fn().mockResolvedValue([]),
      fetchScopeNavigations: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ScopesApiClient>;

    dashboardsService = {
      fetchDashboards: jest.fn().mockResolvedValue(undefined),
      state: {
        scopeNavigations: [],
        dashboards: [],
        drawerOpened: false,
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        searchQuery: '',
      },
    } as unknown as jest.Mocked<ScopesDashboardsService>;

    storeValue = {};
    store = {
      get(key: string) {
        return storeValue[key];
      },
      set(key: string, value: string) {
        storeValue[key] = value;
      },
      subscribe: jest.fn(),
      notifySubscribers: jest.fn(),
      getBool: jest.fn(),
      getObject: jest.fn(),
      setObject: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
    } as unknown as Store;

    service = new ScopesSelectorService(apiClient, dashboardsService, store);
  });

  describe('updateNode', () => {
    it('should update node and fetch children when expanded', async () => {
      await service.updateNode('', true, '');
      expect(service.state.nodes['test-scope-node']).toEqual(mockNode);
      expect(service.state.tree).toMatchObject({
        children: { 'test-scope-node': { expanded: false, scopeNodeId: 'test-scope-node' } },
        expanded: true,
        query: '',
        scopeNodeId: '',
      });
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: '' });
    });

    it.skip('should update node query and fetch children when query changes', async () => {
      await service.updateNode('', true, ''); // Expand first
      // Simulate a change in the query
      await service.updateNode('', true, 'new-qu');
      await service.updateNode('', true, 'new-query');
      expect(service.state.tree).toMatchObject({
        children: {},
        expanded: true,
        query: 'new-query',
        scopeNodeId: '',
      });
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: 'new-query' });
    });

    it('should not fetch children when node is collapsed and query is unchanged', async () => {
      // First expand the node
      await service.updateNode('', true, '');
      // Then collapse it
      await service.updateNode('', false, '');
      // Only the first expansion should trigger fetchNodes
      expect(apiClient.fetchNodes).toHaveBeenCalledTimes(1);
    });

    it.skip('should clear query on first expansion but keep it when filtering within populated node', async () => {
      const mockChildNode: ScopeNode = {
        metadata: { name: 'child-node' },
        spec: { linkId: 'child-scope', linkType: 'scope', parentName: '', nodeType: 'leaf', title: 'child-node' },
      };

      apiClient.fetchNodes.mockResolvedValue([mockChildNode]);

      // Scenario 1: First expansion (no children yet) - clear query for unfiltered view
      await service.updateNode('', true, 'search-query');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: undefined });

      // Parent query should be cleared and child nodes should have no query (first expansion)
      expect(service.state.tree?.query).toBe('');
      let childTreeNode = service.state.tree?.children?.['child-node'];
      expect(childTreeNode?.query).toBe('');

      // Scenario 2: Filtering within node that already has children
      await service.updateNode('', true, 'new-search');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: 'new-search' });

      // Parent and child nodes should have the filter query (filtering within existing children)
      expect(service.state.tree?.query).toBe('new-search');
      childTreeNode = service.state.tree?.children?.['child-node'];
      expect(childTreeNode?.query).toBe('new-search');

      expect(apiClient.fetchNodes).toHaveBeenCalledTimes(2);
    });

    it.skip('should always reset query on any expansion', async () => {
      const mockChildNode: ScopeNode = {
        metadata: { name: 'child-node' },
        spec: { linkId: 'child-scope', linkType: 'scope', parentName: '', nodeType: 'leaf', title: 'child-node' },
      };

      apiClient.fetchNodes.mockResolvedValue([mockChildNode]);

      // First expansion with any query should reset parent query and not pass query to API
      await service.updateNode('', true, 'some-search-query');

      // Verify query is reset and API called without query for first expansion
      expect(service.state.tree?.query).toBe('');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: undefined });
      expect(service.state.tree?.children?.['child-node']?.query).toBe('');
    });

    it.skip('should handle query reset correctly for nested levels beyond root', async () => {
      // Set up mock nodes for multi-level hierarchy
      const mockParentNode: ScopeNode = {
        metadata: { name: 'parent-container' },
        spec: { linkId: '', linkType: 'scope', parentName: '', nodeType: 'container', title: 'Parent Container' },
      };

      const mockChildNode: ScopeNode = {
        metadata: { name: 'child-container' },
        spec: {
          linkId: '',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'container',
          title: 'Child Container',
        },
      };

      const mockGrandchildNode: ScopeNode = {
        metadata: { name: 'grandchild-leaf' },
        spec: {
          linkId: 'leaf-scope',
          linkType: 'scope',
          parentName: 'child-container',
          nodeType: 'leaf',
          title: 'Grandchild Leaf',
        },
      };

      // Mock different responses for different parent nodes
      apiClient.fetchNodes.mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
        if (options.parent === '') {
          return Promise.resolve([mockParentNode]);
        } else if (options.parent === 'parent-container') {
          return Promise.resolve([mockChildNode]);
        } else if (options.parent === 'child-container') {
          return Promise.resolve([mockGrandchildNode]);
        }
        return Promise.resolve([]);
      });

      // Step 1: Expand root node with search query
      await service.updateNode('', true, 'search-query');

      // Root should have query reset, API called without query
      expect(service.state.tree?.query).toBe('');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: '', query: undefined });
      expect(service.state.tree?.children?.['parent-container']?.query).toBe('');

      // Step 2: Expand first-level child with search query
      await service.updateNode('parent-container', true, 'open-search-query');

      // First-level child should have query reset, API called without query
      const parentContainer = service.state.tree?.children?.['parent-container'];
      expect(parentContainer?.query).toBe('');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: 'parent-container', query: undefined });
      expect(parentContainer?.children?.['child-container']?.query).toBe('');

      // Step 3: Now filter within the first-level child (second call to same node)
      await service.updateNode('parent-container', true, 'filter-search');

      // Now both parent and children should show the filter query since we're filtering within existing children
      const newParentContainer = service.state.tree?.children?.['parent-container'];
      expect(newParentContainer?.query).toBe('filter-search');
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: 'parent-container', query: 'filter-search' });
      expect(newParentContainer?.children?.['child-container']?.query).toBe('filter-search');

      expect(apiClient.fetchNodes).toHaveBeenCalledTimes(3);
    });
  });

  describe('selectScope and deselectScope', () => {
    beforeEach(async () => {
      await service.updateNode('', true, '');
    });

    it('should select a scope', async () => {
      await service.selectScope('test-scope-node');
      expect(service.state.selectedScopes).toEqual([{ scopeId: 'test-scope', scopeNodeId: 'test-scope-node' }]);
    });

    it('should deselect a selected scope', async () => {
      await service.selectScope('test-scope-node');
      await service.deselectScope('test-scope-node');
      expect(service.state.selectedScopes).toEqual([]);
    });

    it('should set recent scopes', async () => {
      await service.selectScope('test-scope-node');
    });
  });

  describe('changeScopes', () => {
    it('should apply the provided scope names', async () => {
      await service.changeScopes(['test-scope']);
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope' }]);
    });

    it('should skip update if setting same scopes as are already applied', async () => {
      const subscribeFn = jest.fn();
      const sub = service.subscribeToState(subscribeFn);

      await service.changeScopes(['test-scope', 'recent-scope']);
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope' }, { scopeId: 'recent-scope' }]);
      expect(subscribeFn).toHaveBeenCalledTimes(2);

      await service.changeScopes(['test-scope', 'recent-scope']);
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope' }, { scopeId: 'recent-scope' }]);
      // Should not be called again
      expect(subscribeFn).toHaveBeenCalledTimes(2);

      // Order should not matter
      await service.changeScopes(['recent-scope', 'test-scope']);
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope' }, { scopeId: 'recent-scope' }]);
      // Should not be called again
      expect(subscribeFn).toHaveBeenCalledTimes(2);

      sub.unsubscribe();
    });

    it('should set parent node for recent scopes', async () => {
      // Load mock node
      await service.updateNode('', true, '');

      await service.changeScopes(['test-scope'], 'test-scope-node');
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope', parentNodeId: 'test-scope-node' }]);
      expect(service.state.nodes).toEqual({ 'test-scope-node': mockNode });
      expect(storeValue[RECENT_SCOPES_KEY]).toEqual(JSON.stringify([[{ ...mockScope, parentNode: mockNode }]]));
    });
  });

  describe('open', () => {
    it('should open the selector and load root nodes if not loaded', async () => {
      await service.open();
      expect(service.state.opened).toBe(true);
    });
  });

  describe('closeAndReset', () => {
    it('should close the selector and reset selectedScopes to match appliedScopes', async () => {
      await service.changeScopes(['test-scope']);
      service.closeAndReset();
      expect(service.state.opened).toBe(false);
      expect(service.state.selectedScopes).toEqual(service.state.appliedScopes);
    });
  });

  describe('closeAndApply', () => {
    it('should close the selector and apply the selected scopes', async () => {
      await service.updateNode('', true, '');
      await service.selectScope('test-scope-node');
      await service.closeAndApply();
      expect(service.state.opened).toBe(false);
      expect(service.state.appliedScopes).toEqual(service.state.selectedScopes);
    });
  });

  describe('apply', () => {
    it('should apply the selected scopes without closing the selector', async () => {
      await service.open();
      await service.selectScope('test-scope-node');
      await service.apply();
      expect(service.state.opened).toBe(true);
      expect(service.state.appliedScopes).toEqual(service.state.selectedScopes);
    });
  });

  describe('resetSelection', () => {
    it('should reset selectedScopes to match appliedScopes', async () => {
      await service.changeScopes(['test-scope']);
      service.resetSelection();
      expect(service.state.selectedScopes).toEqual(service.state.appliedScopes);
    });
  });

  describe('removeAllScopes', () => {
    it('should remove all selected and applied scopes', async () => {
      await service.updateNode('', true, '');
      await service.selectScope('test-scope-node');
      await service.apply();
      await service.removeAllScopes();
      expect(service.state.appliedScopes).toEqual([]);
    });
  });

  describe('getRecentScopes', () => {
    it('should parse and filter scopes', async () => {
      await service.updateNode('', true, '');
      await service.selectScope('test-scope-node');
      await service.apply();
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([[mockScope2], [mockScope]]);

      const recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([[mockScope2]]);
    });

    it('should work with old version', async () => {
      await service.updateNode('', true, '');
      await service.selectScope('test-scope-node');
      await service.apply();
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([
        [{ scope: mockScope2, path: [] }],
        [{ scope: mockScope, path: [] }],
      ]);

      const recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([[mockScope2]]);
    });

    it('should return empty on wrong data', async () => {
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([{ scope: mockScope2 }]);

      let recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([]);

      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([]);
      recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([]);

      storeValue[RECENT_SCOPES_KEY] = JSON.stringify(null);
      recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([]);

      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([[{ metadata: { noName: 'test' } }]]);
      recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([]);
    });
  });

  describe('nodes from local storage', () => {
    it('should return parent nodes from recent scopes', async () => {
      // Set mock scopes with parent node
      const mockScopeWithParentNode: RecentScope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'test-scope',
          filters: [],
        },
        parentNode: {
          metadata: { name: 'test-scope-node' },
          spec: {
            linkId: 'test-scope',
            linkType: 'scope',
            parentName: '',
            nodeType: 'container',
            title: 'test-scope-node',
          },
        },
      };

      // Set store value BEFORE creating the service
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([[mockScopeWithParentNode]]);

      // Create service with the existing store (which now has the data)
      service = new ScopesSelectorService(apiClient, dashboardsService, store as Store);
      expect(service.state.nodes).toEqual({ 'test-scope-node': mockScopeWithParentNode.parentNode });
    });

    it('should remove parent node if it is not valid', async () => {
      // Mock with valid parent node
      const mockScopeWithValidParentNode: RecentScope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'test-scope',
          filters: [],
        },
        parentNode: {
          metadata: { name: 'test-scope-node' },
          spec: {
            linkId: 'test-scope',
            linkType: 'scope',
            parentName: '',
            nodeType: 'container',
            title: 'test-scope-node',
          },
        },
      };

      // lacks name and spec
      const mockScopeWithInvalidParentNode: RecentScope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'test-scope',
          filters: [],
        },
        parentNode: {
          //@ts-expect-error
          metadata: {},
          //@ts-expect-error
          spec: {},
        },
      };

      // Set store value BEFORE creating the service
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([
        [mockScopeWithInvalidParentNode],
        [mockScopeWithValidParentNode],
      ]);

      // Create service with the existing store (which now has the data)
      service = new ScopesSelectorService(apiClient, dashboardsService, store as Store);
      expect(service.state.nodes).toEqual({ 'test-scope-node': mockScopeWithValidParentNode.parentNode });
    });

    it('should validate parent nodes across all recent scope sets', async () => {
      // Create multiple scope sets with various parent node validity
      const mockScopeWithValidParentNode: RecentScope = {
        metadata: { name: 'valid-scope' },
        spec: {
          title: 'valid-scope',
          filters: [],
        },
        parentNode: {
          metadata: { name: 'valid-parent-node' },
          spec: {
            linkId: 'valid-scope',
            linkType: 'scope',
            parentName: '',
            nodeType: 'container',
            title: 'valid-parent-node',
          },
        },
      };

      const mockScopeWithInvalidParentNode1: RecentScope = {
        metadata: { name: 'invalid-scope-1' },
        spec: {
          title: 'invalid-scope-1',
          filters: [],
        },
        parentNode: {
          //@ts-expect-error
          metadata: {},
          //@ts-expect-error
          spec: {},
        },
      };

      const mockScopeWithInvalidParentNode2: RecentScope = {
        metadata: { name: 'invalid-scope-2' },
        spec: {
          title: 'invalid-scope-2',
          filters: [],
        },
        parentNode: {
          metadata: { name: 'invalid-parent-node-2' }, // missing spec
          //@ts-expect-error - intentionally invalid spec for testing
          spec: {},
        },
      };

      // Set store value with multiple scope sets - some with invalid parent nodes
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([
        [mockScopeWithInvalidParentNode1],
        [mockScopeWithValidParentNode],
        [mockScopeWithInvalidParentNode2],
      ]);

      // Create service with the existing store
      service = new ScopesSelectorService(apiClient, dashboardsService, store as Store);

      // Should only include the valid parent node
      expect(service.state.nodes).toEqual({ 'valid-parent-node': mockScopeWithValidParentNode.parentNode });

      // Verify that the invalid parent nodes were removed from the stored data
      const recentScopes = service.getRecentScopes();
      expect(recentScopes).toHaveLength(3);
      expect(recentScopes[0][0].parentNode).toBeUndefined(); // invalid parent node should be removed
      expect(recentScopes[1][0].parentNode).toEqual(mockScopeWithValidParentNode.parentNode); // valid parent node should remain
      expect(recentScopes[2][0].parentNode).toBeUndefined(); // invalid parent node should be removed
    });
  });

  describe('redirect on scope selection', () => {
    it('should redirect to the first scopeNavigation with /d/ URL when current URL is not a scopeNavigation', async () => {
      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'test-scope',
            url: '/d/dashboard1',
          },
          status: {
            title: 'Dashboard 1',
            groups: [],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ];

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).toHaveBeenCalledWith('/d/dashboard1');
    });

    it('should NOT redirect when the first scopeNavigation does not contain /d/ (e.g., logs drilldown)', async () => {
      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'test-scope',
            url: '/explore',
          },
          status: {
            title: 'Explore',
            groups: [],
          },
          metadata: {
            name: 'explore1',
          },
        },
      ];

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should NOT redirect when current URL matches a scopeNavigation', async () => {
      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'test-scope',
            url: '/d/dashboard1',
          },
          status: {
            title: 'Dashboard 1',
            groups: [],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ];

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/d/dashboard1' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should NOT redirect when there are no scopeNavigations', async () => {
      dashboardsService.state.scopeNavigations = [];
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should NOT redirect when scopeNavigation does not have a url property', async () => {
      const mockNavigations = [
        {
          spec: {
            scope: 'test-scope',
            // Missing url property
          },
          status: {
            title: 'Dashboard 1',
            groups: [],
          },
          metadata: {
            name: 'dashboard1',
          },
        },
      ] as unknown as ScopeNavigation[];

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should handle multiple scopeNavigations and redirect to the first dashboard one', async () => {
      const mockNavigations: ScopeNavigation[] = [
        {
          spec: {
            scope: 'test-scope',
            url: '/d/first-dashboard',
          },
          status: {
            title: 'First Dashboard',
            groups: [],
          },
          metadata: {
            name: 'first-dashboard',
          },
        },
        {
          spec: {
            scope: 'test-scope',
            url: '/d/second-dashboard',
          },
          status: {
            title: 'Second Dashboard',
            groups: [],
          },
          metadata: {
            name: 'second-dashboard',
          },
        },
      ];

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      // Should redirect to the first one
      expect(locationService.push).toHaveBeenCalledWith('/d/first-dashboard');
      expect(locationService.push).toHaveBeenCalledTimes(1);
    });
  });
});
