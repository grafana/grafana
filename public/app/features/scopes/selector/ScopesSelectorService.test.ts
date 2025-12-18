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
  config: {
    ...jest.requireActual('@grafana/runtime').config,

    featureToggles: {
      ...jest.requireActual('@grafana/runtime').config.featureToggles,
      useScopeSingleNodeEndpoint: true,
    },
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
      fetchScopeNode: jest.fn().mockImplementation((id: string) => {
        // Return undefined for empty string (root node)
        if (id === '') {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(mockNode);
      }),
      fetchMultipleScopeNodes: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ScopesApiClient>;

    dashboardsService = {
      fetchDashboards: jest.fn().mockResolvedValue(undefined),
      setNavigationScope: jest.fn(),
      state: {
        scopeNavigations: [],
        dashboards: [],
        drawerOpened: false,
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        searchQuery: '',
        navigationScope: undefined,
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

  describe('selectScope and deselectScope', () => {
    beforeEach(async () => {
      await service.filterNode('', '');
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
      await service.filterNode('', '');

      await service.changeScopes(['test-scope'], 'test-scope-node');
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope', parentNodeId: 'test-scope-node' }]);
      expect(service.state.nodes).toEqual({ 'test-scope-node': mockNode });
      expect(storeValue[RECENT_SCOPES_KEY]).toEqual(JSON.stringify([[{ ...mockScope, parentNode: mockNode }]]));
    });

    it('should set scopeNodeId for the first scope only', async () => {
      await service.changeScopes(['test-scope', 'test-scope-2'], 'parent-node', 'scope-node-1');

      expect(service.state.appliedScopes).toEqual([
        { scopeId: 'test-scope', scopeNodeId: 'scope-node-1', parentNodeId: 'parent-node' },
        { scopeId: 'test-scope-2', scopeNodeId: undefined, parentNodeId: 'parent-node' },
      ]);
    });

    it('should handle scopeNodeId without parentNodeId', async () => {
      await service.changeScopes(['test-scope'], undefined, 'scope-node-1');

      expect(service.state.appliedScopes).toEqual([
        { scopeId: 'test-scope', scopeNodeId: 'scope-node-1', parentNodeId: undefined },
      ]);
    });

    it('should maintain backward compatibility when only parentNodeId is provided', async () => {
      await service.changeScopes(['test-scope'], 'parent-node');

      expect(service.state.appliedScopes).toEqual([
        { scopeId: 'test-scope', scopeNodeId: undefined, parentNodeId: 'parent-node' },
      ]);
    });
  });

  describe('open', () => {
    it('should open the selector and load root nodes if not loaded', async () => {
      await service.open();
      expect(service.state.opened).toBe(true);
    });

    it('should use scopeNodeId to resolve path when opening selector', async () => {
      const parentNode: ScopeNode = {
        metadata: { name: 'parent-container' },
        spec: {
          linkId: '',
          linkType: 'scope',
          //parentName: '',
          nodeType: 'container',
          title: 'Parent Container',
        },
      };

      const childNode: ScopeNode = {
        metadata: { name: 'child-1' },
        spec: {
          linkId: 'scope-1',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'leaf',
          title: 'Child 1',
        },
      };

      // Mock API responses
      apiClient.fetchNodes.mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent-container') {
          return Promise.resolve([childNode]);
        }
        return Promise.resolve([]);
      });

      apiClient.fetchScopeNode.mockImplementation((scopeNodeId: string) => {
        if (scopeNodeId === 'child-1') {
          return Promise.resolve(childNode);
        }
        return Promise.resolve(undefined);
      });

      // Apply scope with scopeNodeId and parentNodeId set
      await service.changeScopes(['scope-1'], 'parent-container', 'child-1');

      // Open the selector
      await service.open();

      // Verify the tree is expanded to the selected scope's parent
      // The key fix: it should resolve path using scopeNodeId (child-1), not parentNodeId
      expect(service.state.tree?.expanded).toBe(true);
      expect(service.state.tree?.children?.['parent-container']?.expanded).toBe(true);
      expect(service.state.tree?.children?.['parent-container']?.children?.['child-1']).toBeDefined();
    });

    it('should load parent node children when opening to selected scope', async () => {
      const parentNode: ScopeNode = {
        metadata: { name: 'parent-container' },
        spec: {
          linkId: '',
          linkType: 'scope',
          parentName: '',
          nodeType: 'container',
          title: 'Parent Container',
        },
      };

      const childNode1: ScopeNode = {
        metadata: { name: 'child-1' },
        spec: {
          linkId: 'scope-1',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'leaf',
          title: 'Child 1',
        },
      };

      const childNode2: ScopeNode = {
        metadata: { name: 'child-2' },
        spec: {
          linkId: 'scope-2',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'leaf',
          title: 'Child 2',
        },
      };

      const childNode3: ScopeNode = {
        metadata: { name: 'child-3' },
        spec: {
          linkId: 'scope-3',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'leaf',
          title: 'Child 3',
        },
      };

      // Mock API responses
      apiClient.fetchNodes.mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent-container') {
          return Promise.resolve([childNode1, childNode2, childNode3]);
        }
        return Promise.resolve([]);
      });

      apiClient.fetchScopeNode.mockImplementation((scopeNodeId: string) => {
        if (scopeNodeId === 'child-2') {
          return Promise.resolve(childNode2);
        } else if (scopeNodeId === 'parent-container') {
          return Promise.resolve(parentNode);
        }
        return Promise.resolve(undefined);
      });

      await service.changeScopes(['scope-2'], 'parent-container', 'child-2');
      await service.open();

      // Verify all sibling nodes are loaded (not just the selected one)
      expect(service.state.tree?.children?.['parent-container']?.children?.['child-1']).toBeDefined();
      expect(service.state.tree?.children?.['parent-container']?.children?.['child-2']).toBeDefined();
      expect(service.state.tree?.children?.['parent-container']?.children?.['child-3']).toBeDefined();

      // Verify childrenLoaded flag is set on the parent
      expect(service.state.tree?.children?.['parent-container']?.childrenLoaded).toBe(true);
    });

    it('should only load children if childrenLoaded is false', async () => {
      const parentNode: ScopeNode = {
        metadata: { name: 'parent-container' },
        spec: {
          linkId: '',
          linkType: 'scope',
          parentName: '',
          nodeType: 'container',
          title: 'Parent Container',
        },
      };

      const childNode: ScopeNode = {
        metadata: { name: 'child-1' },
        spec: {
          linkId: 'scope-1',
          linkType: 'scope',
          parentName: 'parent-container',
          nodeType: 'leaf',
          title: 'Child 1',
        },
      };

      apiClient.fetchNodes.mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent-container') {
          return Promise.resolve([childNode]);
        }
        return Promise.resolve([]);
      });

      apiClient.fetchScopeNode.mockImplementation((scopeNodeId: string) => {
        if (scopeNodeId === 'child-1') {
          return Promise.resolve(childNode);
        } else if (scopeNodeId === 'parent-container') {
          return Promise.resolve(parentNode);
        }
        return Promise.resolve(undefined);
      });

      await service.changeScopes(['scope-1'], 'parent-container', 'child-1');

      // First open
      await service.open();

      // Close and open again
      service.closeAndReset();
      await service.open();

      // The key: childrenLoaded flag should prevent redundant fetches
      // Verify the flag is set correctly
      expect(service.state.tree?.children?.['parent-container']?.childrenLoaded).toBe(true);
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
      await service.filterNode('', '');
      await service.selectScope('test-scope-node');
      await service.closeAndApply();
      expect(service.state.opened).toBe(false);
      expect(service.state.appliedScopes).toEqual(service.state.selectedScopes);
    });
  });

  describe('apply', () => {
    it('should apply the selected scopes without closing the selector', async () => {
      await service.filterNode('', '');
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
      await service.filterNode('', '');
      await service.selectScope('test-scope-node');
      await service.apply();
      service.removeAllScopes();
      expect(service.state.appliedScopes).toEqual([]);
    });

    it('should clear navigation scope when removing all scopes', async () => {
      await service.filterNode('', '');
      await service.selectScope('test-scope-node');
      await service.apply();
      service.removeAllScopes();
      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe('navigation scope interaction', () => {
    it('should skip fetchDashboards when navigationScope is set', async () => {
      dashboardsService.state.navigationScope = 'navScope1';
      jest.clearAllMocks();

      await service.changeScopes(['test-scope']);

      expect(dashboardsService.fetchDashboards).not.toHaveBeenCalled();
    });

    it('should call fetchDashboards when navigationScope is not set', async () => {
      dashboardsService.state.navigationScope = undefined;
      jest.clearAllMocks();

      await service.changeScopes(['test-scope']);

      expect(dashboardsService.fetchDashboards).toHaveBeenCalledWith(['test-scope']);
    });
  });

  describe('getRecentScopes', () => {
    it('should parse and filter scopes', async () => {
      await service.filterNode('', '');
      await service.selectScope('test-scope-node');
      await service.apply();
      storeValue[RECENT_SCOPES_KEY] = JSON.stringify([[mockScope2], [mockScope]]);

      const recentScopes = service.getRecentScopes();
      expect(recentScopes).toEqual([[mockScope2]]);
    });

    it('should work with old version', async () => {
      await service.filterNode('', '');
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

  describe('toggleExpandedNode', () => {
    const expandableNode: ScopeNode = {
      metadata: { name: 'expandable-node' },
      spec: {
        linkId: '',
        linkType: undefined,
        parentName: '',
        nodeType: 'container',
        title: 'Expandable Node',
      },
    };

    const childNode: ScopeNode = {
      metadata: { name: 'child-node' },
      spec: {
        linkId: 'child-scope',
        linkType: 'scope',
        parentName: 'expandable-node',
        nodeType: 'leaf',
        title: 'Child Node',
      },
    };

    const leafNode: ScopeNode = {
      metadata: { name: 'leaf-node' },
      spec: {
        linkId: 'leaf-scope',
        linkType: 'scope',
        parentName: '',
        nodeType: 'leaf',
        title: 'Leaf Node',
      },
    };

    beforeEach(async () => {
      // Mock fetchNodes to return different nodes based on parent
      apiClient.fetchNodes = jest
        .fn()
        .mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
          if (options.parent === '') {
            return [expandableNode, leafNode];
          } else if (options.parent === 'expandable-node') {
            return [childNode];
          }
          return [];
        });

      // Load root nodes
      await service.filterNode('', '');
    });

    it('should expand a collapsed node and load its children', async () => {
      // Node should start collapsed
      expect(service.state.tree?.children?.['expandable-node']?.expanded).toBe(false);

      // Expand the node
      await service.toggleExpandedNode('expandable-node');

      // Node should now be expanded
      expect(service.state.tree?.children?.['expandable-node']?.expanded).toBe(true);
      // Children should be loaded
      expect(service.state.tree?.children?.['expandable-node']?.children).toBeDefined();
      expect(service.state.tree?.children?.['expandable-node']?.children?.['child-node']).toBeDefined();
    });

    it('should collapse an expanded node', async () => {
      // First expand the node
      await service.toggleExpandedNode('expandable-node');
      expect(service.state.tree?.children?.['expandable-node']?.expanded).toBe(true);

      // Now collapse it
      await service.toggleExpandedNode('expandable-node');
      expect(service.state.tree?.children?.['expandable-node']?.expanded).toBe(false);
    });

    it('should reset query to empty string when toggling', async () => {
      // First filter with a query
      await service.filterNode('expandable-node', 'test-query');
      expect(service.state.tree?.children?.['expandable-node']?.query).toBe('test-query');

      // Toggle the node
      await service.toggleExpandedNode('expandable-node');

      // Query should be reset
      expect(service.state.tree?.children?.['expandable-node']?.query).toBe('');
    });

    it('should throw error when node not found in tree', async () => {
      await expect(service.toggleExpandedNode('non-existent-node')).rejects.toThrow(
        'Node non-existent-node not found in tree'
      );
    });

    it('should throw error when trying to toggle a non-expandable node', async () => {
      await expect(service.toggleExpandedNode('leaf-node')).rejects.toThrow(
        'Trying to expand node at id leaf-node that is not expandable'
      );
    });

    it('should reload parent children when collapsing', async () => {
      const fetchNodesSpy = jest.spyOn(apiClient, 'fetchNodes');

      // Expand then collapse
      await service.toggleExpandedNode('expandable-node');
      fetchNodesSpy.mockClear();

      await service.toggleExpandedNode('expandable-node');

      // Should reload parent's (root) children
      expect(fetchNodesSpy).toHaveBeenCalledWith({ parent: '', query: '' });
    });

    it('should reload parent children with parent query when collapsing', async () => {
      // First filter the root with a query
      await service.filterNode('', 'parent-query');

      // Expand a node
      await service.toggleExpandedNode('expandable-node');

      const fetchNodesSpy = jest.spyOn(apiClient, 'fetchNodes');

      // Collapse the node
      await service.toggleExpandedNode('expandable-node');

      // Should reload parent's children with parent's query
      expect(fetchNodesSpy).toHaveBeenCalledWith({ parent: '', query: 'parent-query' });
    });
  });

  describe('filterNode', () => {
    const containerNode: ScopeNode = {
      metadata: { name: 'container-node' },
      spec: {
        linkId: '',
        linkType: undefined,
        parentName: '',
        nodeType: 'container',
        title: 'Container Node',
      },
    };

    const filteredChild: ScopeNode = {
      metadata: { name: 'filtered-child' },
      spec: {
        linkId: 'filtered-scope',
        linkType: 'scope',
        parentName: 'container-node',
        nodeType: 'leaf',
        title: 'Filtered Child',
      },
    };

    const leafNode: ScopeNode = {
      metadata: { name: 'leaf-node-2' },
      spec: {
        linkId: 'leaf-scope-2',
        linkType: 'scope',
        parentName: '',
        nodeType: 'leaf',
        title: 'Leaf Node 2',
      },
    };

    beforeEach(async () => {
      // Mock fetchNodes to return different nodes based on query
      apiClient.fetchNodes = jest
        .fn()
        .mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
          if (options.parent === '' && !options.query) {
            return [containerNode, leafNode];
          } else if (options.parent === 'container-node' && options.query === 'test-filter') {
            return [filteredChild];
          } else if (options.parent === 'container-node' && !options.query) {
            return [filteredChild];
          }
          return [];
        });

      // Load root nodes
      await service.filterNode('', '');
    });

    it('should filter node with non-empty query', async () => {
      await service.filterNode('container-node', 'test-filter');

      // Node should be expanded
      expect(service.state.tree?.children?.['container-node']?.expanded).toBe(true);
      // Query should be set
      expect(service.state.tree?.children?.['container-node']?.query).toBe('test-filter');
    });

    it('should load children with the query parameter', async () => {
      const fetchNodesSpy = jest.spyOn(apiClient, 'fetchNodes');

      await service.filterNode('container-node', 'my-query');

      expect(fetchNodesSpy).toHaveBeenCalledWith({ parent: 'container-node', query: 'my-query' });
    });

    it('should set expanded to true when filtering', async () => {
      // Node starts collapsed
      expect(service.state.tree?.children?.['container-node']?.expanded).toBe(false);

      await service.filterNode('container-node', 'test-filter');

      // Should be expanded after filtering
      expect(service.state.tree?.children?.['container-node']?.expanded).toBe(true);
    });

    it('should throw error when node not found', async () => {
      await expect(service.filterNode('non-existent-node', 'query')).rejects.toThrow(
        'Trying to filter node at path or id non-existent-node not found'
      );
    });

    it('should throw error when trying to filter a non-expandable node', async () => {
      await expect(service.filterNode('leaf-node-2', 'query')).rejects.toThrow(
        'Trying to filter node at id leaf-node-2 that is not expandable'
      );
    });

    it('should handle multiple calls with different queries', async () => {
      // First filter
      await service.filterNode('container-node', 'first-query');
      expect(service.state.tree?.children?.['container-node']?.query).toBe('first-query');

      // Second filter with different query
      await service.filterNode('container-node', 'second-query');
      expect(service.state.tree?.children?.['container-node']?.query).toBe('second-query');

      // Third filter with empty query
      await service.filterNode('container-node', '');
      expect(service.state.tree?.children?.['container-node']?.query).toBe('');
    });

    it('should start profiler interaction', async () => {
      const profiler = {
        startInteraction: jest.fn(),
        stopInteraction: jest.fn(),
      };

      // Create new service with profiler
      const serviceWithProfiler = new ScopesSelectorService(apiClient, dashboardsService, store, profiler as never);

      await serviceWithProfiler.filterNode('', '');

      expect(profiler.startInteraction).toHaveBeenCalledWith('scopeNodeFilter');
      expect(profiler.stopInteraction).toHaveBeenCalled();
    });

    it('should stop profiler even when error is thrown', async () => {
      const profiler = {
        startInteraction: jest.fn(),
        stopInteraction: jest.fn(),
      };

      const serviceWithProfiler = new ScopesSelectorService(apiClient, dashboardsService, store, profiler as never);

      // Load initial nodes
      await serviceWithProfiler.filterNode('', '');

      // Try to filter a non-existent node
      await expect(serviceWithProfiler.filterNode('non-existent', 'query')).rejects.toThrow();

      // Profiler should still be stopped
      expect(profiler.stopInteraction).toHaveBeenCalled();
    });
  });

  describe('interaction between toggleExpandedNode and filterNode', () => {
    const expandableNode: ScopeNode = {
      metadata: { name: 'interaction-node' },
      spec: {
        linkId: '',
        linkType: undefined,
        parentName: '',
        nodeType: 'container',
        title: 'Interaction Node',
      },
    };

    const childNode: ScopeNode = {
      metadata: { name: 'interaction-child' },
      spec: {
        linkId: 'child-scope',
        linkType: 'scope',
        parentName: 'interaction-node',
        nodeType: 'leaf',
        title: 'Child Node',
      },
    };

    beforeEach(async () => {
      apiClient.fetchNodes = jest
        .fn()
        .mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
          if (options.parent === '') {
            return [expandableNode];
          } else if (options.parent === 'interaction-node') {
            return [childNode];
          }
          return [];
        });

      await service.filterNode('', '');
    });

    it('should clear query when toggleExpandedNode is called after filterNode', async () => {
      // Filter with a query
      await service.filterNode('interaction-node', 'test-query');
      expect(service.state.tree?.children?.['interaction-node']?.query).toBe('test-query');

      // Toggle should clear the query
      await service.toggleExpandedNode('interaction-node');
      expect(service.state.tree?.children?.['interaction-node']?.query).toBe('');
    });

    it('should set query when filterNode is called after toggleExpandedNode', async () => {
      // First toggle (expand)
      await service.toggleExpandedNode('interaction-node');
      expect(service.state.tree?.children?.['interaction-node']?.query).toBe('');

      // Filter should set the query
      await service.filterNode('interaction-node', 'new-query');
      expect(service.state.tree?.children?.['interaction-node']?.query).toBe('new-query');
    });

    it('should maintain expanded state when filtering an already expanded node', async () => {
      // Expand the node
      await service.toggleExpandedNode('interaction-node');
      expect(service.state.tree?.children?.['interaction-node']?.expanded).toBe(true);

      // Filter should keep it expanded
      await service.filterNode('interaction-node', 'query');
      expect(service.state.tree?.children?.['interaction-node']?.expanded).toBe(true);
    });
  });

  describe('redirect on scope selection', () => {
    it('should redirect to the first scopeNavigation with /d/ URL when current URL is not a scopeNavigation', async () => {
      dashboardsService.state.scopeNavigations = [
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
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).toHaveBeenCalledWith('/d/dashboard1');
    });

    it('should NOT redirect when the first scopeNavigation does not contain /d/ (e.g., logs drilldown)', async () => {
      dashboardsService.state.scopeNavigations = [
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
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should NOT redirect when current URL matches a scopeNavigation', async () => {
      dashboardsService.state.scopeNavigations = [
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
      dashboardsService.state.scopeNavigations = [
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
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      expect(locationService.push).not.toHaveBeenCalled();
    });

    it('should handle multiple scopeNavigations and redirect to the first dashboard one', async () => {
      dashboardsService.state.scopeNavigations = [
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
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      // Should redirect to the first one
      expect(locationService.push).toHaveBeenCalledWith('/d/first-dashboard');
      expect(locationService.push).toHaveBeenCalledTimes(1);
    });

    it('should redirect to redirectUrl when scope node has explicit redirectUrl', async () => {
      const mockNodeWithRedirect: ScopeNode = {
        metadata: { name: 'test-scope-node' },
        spec: {
          linkId: 'test-scope',
          linkType: 'scope',
          parentName: '',
          nodeType: 'leaf',
          title: 'test-scope-node',
          redirectPath: '/custom-redirect-url',
        },
      };

      // Mock fetchNodes to return the node with redirectPath
      apiClient.fetchNodes = jest
        .fn()
        .mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
          if (options.parent === '' && !options.query) {
            return [mockNodeWithRedirect];
          } else {
            return [];
          }
        });

      // First update the node to populate the service state
      await service.filterNode('', '');

      // Then select the scope to set scopeNodeId in selectedScopes
      await service.selectScope('test-scope-node');

      // Then apply to trigger the redirect
      await service.apply();

      expect(locationService.push).toHaveBeenCalledWith('/custom-redirect-url');
    });

    it('should prioritize redirectUrl over scope navigation fallback', async () => {
      const mockNodeWithRedirect: ScopeNode = {
        metadata: { name: 'test-scope-node' },
        spec: {
          linkId: 'test-scope',
          linkType: 'scope',
          parentName: '',
          nodeType: 'leaf',
          title: 'test-scope-node',
          redirectPath: '/priority-redirect',
        },
      };

      const mockNavigations: ScopeNavigation[] = [
        {
          spec: { scope: 'test-scope', url: '/d/dashboard1' },
          status: { title: 'Dashboard 1', groups: [] },
          metadata: { name: 'dashboard1' },
        },
      ];

      // Mock fetchNodes to return the node with redirectPath
      apiClient.fetchNodes = jest
        .fn()
        .mockImplementation((options: { parent?: string; query?: string; limit?: number }) => {
          if (options.parent === '' && !options.query) {
            return [mockNodeWithRedirect];
          } else {
            return [];
          }
        });

      dashboardsService.state.scopeNavigations = mockNavigations;
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      // First update the node to populate the service state
      await service.filterNode('', '');

      // Then select the scope to set scopeNodeId in selectedScopes
      await service.selectScope('test-scope-node');

      // Then apply to trigger the redirect
      await service.apply();

      // Should use redirectPath, not scope navigation
      expect(locationService.push).toHaveBeenCalledWith('/priority-redirect');
      expect(locationService.push).toHaveBeenCalledTimes(1);
    });

    it('should fall back to scope navigation when scope node is undefined', async () => {
      // Don't add the node to the service state, so it will be undefined
      dashboardsService.state.scopeNavigations = [
        {
          spec: { scope: 'test-scope', url: '/d/dashboard1' },
          status: { title: 'Dashboard 1', groups: [] },
          metadata: { name: 'dashboard1' },
        },
      ];
      (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-other-page' });

      await service.changeScopes(['test-scope']);

      // Should fall back to scope navigation since scope node is undefined
      expect(locationService.push).toHaveBeenCalledWith('/d/dashboard1');
    });
  });

  // Mock data for defaultPath and path helper tests
  const regionNode: ScopeNode = {
    metadata: { name: 'region-us-west' },
    spec: {
      nodeType: 'container',
      title: 'US West',
      parentName: '',
      linkType: undefined,
      linkId: undefined,
    },
  };

  const countryNode: ScopeNode = {
    metadata: { name: 'country-usa' },
    spec: {
      nodeType: 'container',
      title: 'USA',
      parentName: 'region-us-west',
      linkType: undefined,
      linkId: undefined,
    },
  };

  const cityNode: ScopeNode = {
    metadata: { name: 'city-seattle' },
    spec: {
      nodeType: 'container',
      title: 'Seattle',
      parentName: 'country-usa',
      linkType: undefined,
      linkId: undefined,
    },
  };

  const datacenterNode: ScopeNode = {
    metadata: { name: 'datacenter-sea-1' },
    spec: {
      nodeType: 'leaf',
      title: 'SEA-1',
      parentName: 'city-seattle',
      linkType: 'scope',
      linkId: 'scope-sea-1',
    },
  };

  const scopeWithDefaultPath: Scope = {
    metadata: { name: 'scope-sea-1' },
    spec: {
      title: 'Seattle Datacenter 1',
      defaultPath: ['region-us-west', 'country-usa', 'city-seattle', 'datacenter-sea-1'],
      filters: [],
    },
  };

  const scopeWithoutDefaultPath: Scope = {
    metadata: { name: 'scope-no-path' },
    spec: {
      title: 'No Path Scope',
      filters: [],
    },
  };

  const parentNode: ScopeNode = {
    metadata: { name: 'parent' },
    spec: {
      nodeType: 'container',
      title: 'Parent',
      parentName: '',
      linkType: undefined,
      linkId: undefined,
    },
  };

  const childNode: ScopeNode = {
    metadata: { name: 'child' },
    spec: {
      nodeType: 'leaf',
      title: 'Child',
      parentName: 'parent',
      linkType: 'scope',
      linkId: 'test-scope',
    },
  };

  const grandchildNode: ScopeNode = {
    metadata: { name: 'grandchild' },
    spec: {
      nodeType: 'leaf',
      title: 'Grandchild',
      parentName: 'child',
      linkType: 'scope',
      linkId: 'test-scope-2',
    },
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Tests for defaultPath functionality
  // Note: Tests access protected updateState method via (service as any) casting to set up test state
  describe('getScopeNodes', () => {
    it('should return cached nodes when available', async () => {
      // Pre-populate cache
      (service as any).updateState({
        nodes: {
          'region-us-west': regionNode,
          'country-usa': countryNode,
        },
      });

      const result = await service.getScopeNodes(['region-us-west', 'country-usa']);

      expect(result).toEqual([regionNode, countryNode]);
      expect(apiClient.fetchMultipleScopeNodes).not.toHaveBeenCalled();
    });

    it('should fetch only non-cached nodes', async () => {
      // Pre-populate cache with one node
      (service as any).updateState({
        nodes: {
          'region-us-west': regionNode,
        },
      });

      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([countryNode]);

      const result = await service.getScopeNodes(['region-us-west', 'country-usa']);

      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(['country-usa']);
      expect(result).toEqual([regionNode, countryNode]);
    });

    it('should maintain order of requested nodes', async () => {
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([cityNode, countryNode, regionNode]);

      const result = await service.getScopeNodes(['region-us-west', 'country-usa', 'city-seattle']);

      expect(result).toEqual([regionNode, countryNode, cityNode]);
    });

    it('should update state with fetched nodes', async () => {
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([regionNode, countryNode]);

      await service.getScopeNodes(['region-us-west', 'country-usa']);

      expect(service.state.nodes).toEqual({
        'region-us-west': regionNode,
        'country-usa': countryNode,
      });
    });

    it('should handle empty array input', async () => {
      const result = await service.getScopeNodes([]);

      expect(result).toEqual([]);
      expect(apiClient.fetchMultipleScopeNodes).not.toHaveBeenCalled();
    });

    it('should filter out undefined nodes', async () => {
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([]);

      const result = await service.getScopeNodes(['non-existent-node']);

      expect(result).toEqual([]);
    });
  });

  describe('resolvePathToRoot with defaultPath', () => {
    beforeEach(() => {
      apiClient.fetchMultipleScopeNodes = jest
        .fn()
        .mockResolvedValue([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should use defaultPath when scope has it defined', async () => {
      // Pre-populate scope cache
      (service as any).updateState({
        scopes: {
          'scope-sea-1': scopeWithDefaultPath,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree, 'scope-sea-1');

      // Should fetch all nodes in defaultPath at once
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith([
        'region-us-west',
        'country-usa',
        'city-seattle',
        'datacenter-sea-1',
      ]);
      expect(result.path).toEqual([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should fall back to recursive path walking when no scopeId provided', async () => {
      // Setup nodes in cache for recursive walking
      (service as any).updateState({
        nodes: {
          'datacenter-sea-1': datacenterNode,
          'city-seattle': cityNode,
          'country-usa': countryNode,
          'region-us-west': regionNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree);

      expect(result.path).toEqual([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should fall back when scope has no defaultPath', async () => {
      (service as any).updateState({
        scopes: {
          'scope-no-path': scopeWithoutDefaultPath,
        },
        nodes: {
          'datacenter-sea-1': datacenterNode,
          'city-seattle': cityNode,
          'country-usa': countryNode,
          'region-us-west': regionNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree, 'scope-no-path');

      expect(result.path).toEqual([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should insert path nodes into tree', async () => {
      (service as any).updateState({
        scopes: {
          'scope-sea-1': scopeWithDefaultPath,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree, 'scope-sea-1');

      expect(result.tree.children?.['region-us-west']).toBeDefined();
      expect(result.tree.children?.['region-us-west']?.children?.['country-usa']).toBeDefined();
      expect(
        result.tree.children?.['region-us-west']?.children?.['country-usa']?.children?.['city-seattle']
      ).toBeDefined();
    });
  });

  describe('applyScopes with defaultPath pre-fetching', () => {
    it('should pre-fetch all nodes from defaultPath when applying scopes', async () => {
      apiClient.fetchMultipleScopes = jest.fn().mockResolvedValue([scopeWithDefaultPath]);
      apiClient.fetchMultipleScopeNodes = jest
        .fn()
        .mockResolvedValue([regionNode, countryNode, cityNode, datacenterNode]);

      await service.changeScopes(['scope-sea-1']);

      // Should batch fetch all nodes in defaultPath
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith([
        'region-us-west',
        'country-usa',
        'city-seattle',
        'datacenter-sea-1',
      ]);

      // All nodes should be in cache
      expect(service.state.nodes['region-us-west']).toEqual(regionNode);
      expect(service.state.nodes['country-usa']).toEqual(countryNode);
      expect(service.state.nodes['city-seattle']).toEqual(cityNode);
      expect(service.state.nodes['datacenter-sea-1']).toEqual(datacenterNode);
    });

    it("should only pre-fetch the first scope's defaultPath", async () => {
      const scope2: Scope = {
        metadata: { name: 'scope-2' },
        spec: {
          title: 'Scope 2',
          defaultPath: ['region-us-west', 'country-usa', 'city-portland', 'datacenter-pdx-1'],
          filters: [],
        },
      };

      const portlandNode: ScopeNode = {
        metadata: { name: 'city-portland' },
        spec: {
          nodeType: 'container',
          title: 'Portland',
          parentName: 'country-usa',
          linkType: undefined,
          linkId: undefined,
        },
      };

      const pdxDatacenterNode: ScopeNode = {
        metadata: { name: 'datacenter-pdx-1' },
        spec: {
          nodeType: 'leaf',
          title: 'PDX-1',
          parentName: 'city-portland',
          linkType: 'scope',
          linkId: 'scope-2',
        },
      };

      apiClient.fetchMultipleScopes = jest.fn().mockResolvedValue([scopeWithDefaultPath, scope2]);
      apiClient.fetchMultipleScopeNodes = jest
        .fn()
        .mockResolvedValue([regionNode, countryNode, cityNode, datacenterNode, portlandNode, pdxDatacenterNode]);

      await service.changeScopes(['scope-sea-1', 'scope-2']);

      // Should only fetch the first scope's defaultPath (not the second scope's)
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith([
        'region-us-west',
        'country-usa',
        'city-seattle',
        'datacenter-sea-1',
      ]);
    });

    it('should not fetch when scopes have no defaultPath', async () => {
      apiClient.fetchMultipleScopes = jest.fn().mockResolvedValue([scopeWithoutDefaultPath]);

      await service.changeScopes(['scope-no-path']);

      expect(apiClient.fetchMultipleScopeNodes).not.toHaveBeenCalled();
    });

    it('should handle empty defaultPath array', async () => {
      const scopeWithEmptyPath: Scope = {
        metadata: { name: 'scope-empty' },
        spec: {
          title: 'Scope Empty',
          defaultPath: [],
          filters: [],
        },
      };

      apiClient.fetchMultipleScopes = jest.fn().mockResolvedValue([scopeWithEmptyPath]);

      await service.changeScopes(['scope-empty']);

      expect(apiClient.fetchMultipleScopeNodes).not.toHaveBeenCalled();
    });
  });

  describe('open selector with defaultPath expansion', () => {
    beforeEach(() => {
      apiClient.fetchNodes = jest.fn().mockImplementation((options) => {
        // Return children based on parent
        if (options.parent === '') {
          return Promise.resolve([regionNode]);
        } else if (options.parent === 'region-us-west') {
          return Promise.resolve([countryNode]);
        } else if (options.parent === 'country-usa') {
          return Promise.resolve([cityNode]);
        } else if (options.parent === 'city-seattle') {
          return Promise.resolve([datacenterNode]);
        }
        return Promise.resolve([]);
      });
      apiClient.fetchMultipleScopeNodes = jest
        .fn()
        .mockResolvedValue([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should expand to defaultPath when opening selector with applied scope', async () => {
      // Apply a scope with defaultPath
      (service as any).updateState({
        scopes: { 'scope-sea-1': scopeWithDefaultPath },
        appliedScopes: [{ scopeId: 'scope-sea-1', scopeNodeId: 'datacenter-sea-1' }],
        selectedScopes: [{ scopeId: 'scope-sea-1', scopeNodeId: 'datacenter-sea-1' }],
      });

      await service.open();

      // Should fetch all nodes in the path
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalled();

      // Tree should be expanded to show the path
      expect(service.state.tree.children?.['region-us-west']?.expanded).toBe(true);
      expect(service.state.tree.children?.['region-us-west']?.children?.['country-usa']?.expanded).toBe(true);
      expect(
        service.state.tree.children?.['region-us-west']?.children?.['country-usa']?.children?.['city-seattle']?.expanded
      ).toBe(true);
    });

    it('should fall back to parentNodeId when scope has no defaultPath', async () => {
      // Pre-populate nodes for fallback behavior
      (service as any).updateState({
        scopes: { 'scope-no-path': scopeWithoutDefaultPath },
        nodes: {
          'datacenter-sea-1': datacenterNode,
          'city-seattle': cityNode,
          'country-usa': countryNode,
          'region-us-west': regionNode,
        },
        appliedScopes: [{ scopeId: 'scope-no-path', scopeNodeId: 'datacenter-sea-1', parentNodeId: 'city-seattle' }],
        selectedScopes: [{ scopeId: 'scope-no-path', scopeNodeId: 'datacenter-sea-1', parentNodeId: 'city-seattle' }],
      });

      await service.open();

      // Should still expand, but using parentNodeId logic
      expect(service.state.opened).toBe(true);
    });

    it('should handle opening selector when scope is not yet loaded', async () => {
      (service as any).updateState({
        appliedScopes: [{ scopeId: 'scope-sea-1' }],
        selectedScopes: [{ scopeId: 'scope-sea-1' }],
      });

      await service.open();

      // Should not crash, just open with root nodes
      expect(service.state.opened).toBe(true);
    });
  });

  describe('performance improvements', () => {
    it('should make only 1 API call for deep hierarchy with defaultPath', async () => {
      (service as any).updateState({
        scopes: { 'scope-sea-1': scopeWithDefaultPath },
      });

      apiClient.fetchMultipleScopeNodes = jest
        .fn()
        .mockResolvedValue([regionNode, countryNode, cityNode, datacenterNode]);

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      await service.resolvePathToRoot('datacenter-sea-1', tree, 'scope-sea-1');

      // Should make exactly 1 API call
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledTimes(1);
    });

    it('should make N API calls for deep hierarchy without defaultPath (old behavior)', async () => {
      // This test documents the old recursive behavior for comparison
      apiClient.fetchScopeNode = jest.fn().mockImplementation((id: string) => {
        const nodeMap: Record<string, ScopeNode> = {
          'datacenter-sea-1': datacenterNode,
          'city-seattle': cityNode,
          'country-usa': countryNode,
          'region-us-west': regionNode,
        };
        return Promise.resolve(nodeMap[id]);
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      await service.resolvePathToRoot('datacenter-sea-1', tree);

      // Would make 4 sequential calls in the old implementation
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('datacenter-sea-1');
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('city-seattle');
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('country-usa');
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('region-us-west');
      expect(apiClient.fetchScopeNode).toHaveBeenCalledTimes(4);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle defaultPath with missing nodes gracefully', async () => {
      (service as any).updateState({
        scopes: { 'scope-sea-1': scopeWithDefaultPath },
      });

      // API returns fewer nodes than requested
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([regionNode, countryNode]);

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree, 'scope-sea-1');

      // Should handle partial path gracefully
      expect(result.path).toEqual([regionNode, countryNode]);
    });

    it('should handle API errors during batch fetch', async () => {
      (service as any).updateState({
        scopes: { 'scope-sea-1': scopeWithDefaultPath },
      });

      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([]);

      await service.changeScopes(['scope-sea-1']);

      // Should not crash, state should be consistent
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'scope-sea-1' }]);
    });

    it('should deduplicate node IDs in defaultPath', async () => {
      const scopeWithDuplicates: Scope = {
        metadata: { name: 'scope-dupe' },
        spec: {
          title: 'Scope with Duplicates',
          defaultPath: ['region-us-west', 'country-usa', 'region-us-west', 'country-usa'],
          filters: [],
        },
      };

      apiClient.fetchMultipleScopes = jest.fn().mockResolvedValue([scopeWithDuplicates]);
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([regionNode, countryNode]);

      await service.changeScopes(['scope-dupe']);

      // Should only fetch unique nodes
      const calledWith = apiClient.fetchMultipleScopeNodes.mock.calls[0][0];
      const uniqueNodes = [...new Set(calledWith)];
      expect(calledWith.length).toBe(uniqueNodes.length);
    });

    it('should handle defaultPath with only root node', async () => {
      const scopeWithRootOnly: Scope = {
        metadata: { name: 'scope-root' },
        spec: {
          title: 'Scope Root Only',
          defaultPath: ['region-us-west'],
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'scope-root': scopeWithRootOnly },
      });

      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([regionNode]);

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('region-us-west', tree, 'scope-root');

      expect(result.path).toEqual([regionNode]);
    });
  });

  describe('backwards compatibility', () => {
    it('should work with existing code that does not provide scopeId to resolvePathToRoot', async () => {
      (service as any).updateState({
        nodes: {
          'datacenter-sea-1': datacenterNode,
          'city-seattle': cityNode,
          'country-usa': countryNode,
          'region-us-west': regionNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('datacenter-sea-1', tree);

      expect(result.path).toEqual([regionNode, countryNode, cityNode, datacenterNode]);
    });

    it('should not break when scope metadata is loaded after applying', async () => {
      // This simulates the async nature of scope loading
      apiClient.fetchMultipleScopes = jest.fn().mockImplementation(async () => {
        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [scopeWithDefaultPath];
      });

      await service.changeScopes(['scope-sea-1']);

      // Scope should eventually be in state
      expect(service.state.scopes['scope-sea-1']).toEqual(scopeWithDefaultPath);
    });
  });

  // Tests for path helper methods
  describe('getPathForScope (new helper method)', () => {
    it('should prefer defaultPath from scope metadata', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child'],
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'test-scope': scope },
      });

      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([parentNode, childNode]);

      // This tests the new getPathForScope method that should be created
      // For now, this is testing the expected behavior through resolvePathToRoot
      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('child', tree, 'test-scope');

      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(['parent', 'child']);
      expect(result.path).toEqual([parentNode, childNode]);
    });

    it('should fall back to scopeNodeId when no defaultPath', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'test-scope': scope },
        nodes: {
          parent: parentNode,
          child: childNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('child', tree, 'test-scope');

      expect(result.path).toEqual([parentNode, childNode]);
    });

    it('should return empty array when both scopeId and scopeNodeId are undefined', async () => {
      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('', tree);

      expect(result.path).toEqual([]);
    });

    it('should handle scope not being in cache yet', async () => {
      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      (service as any).updateState({
        nodes: {
          parent: parentNode,
          child: childNode,
        },
      });

      // Scope not in cache, but scopeNodeId is provided
      const result = await service.resolvePathToRoot('child', tree, 'unknown-scope');

      // Should fall back to node-based path
      expect(result.path).toEqual([parentNode, childNode]);
    });
  });

  describe('getNodePath - optimized implementation', () => {
    it('should build path from cached nodes without API calls', async () => {
      (service as any).updateState({
        nodes: {
          parent: parentNode,
          child: childNode,
          grandchild: grandchildNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('grandchild', tree);

      // Should not make any API calls since all nodes are cached
      expect(apiClient.fetchScopeNode).not.toHaveBeenCalled();
      expect(result.path).toEqual([parentNode, childNode, grandchildNode]);
    });

    it('should fetch missing nodes in the path', async () => {
      // Only grandchild is cached
      (service as any).updateState({
        nodes: {
          grandchild: grandchildNode,
        },
      });

      apiClient.fetchScopeNode = jest.fn().mockImplementation((id: string) => {
        if (id === 'child') {
          return Promise.resolve(childNode);
        }
        if (id === 'parent') {
          return Promise.resolve(parentNode);
        }
        return Promise.resolve(undefined);
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      await service.resolvePathToRoot('grandchild', tree);

      // Should fetch missing parent nodes
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('child');
      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('parent');
    });

    it('should handle circular references gracefully', async () => {
      const circularNode1: ScopeNode = {
        metadata: { name: 'node1' },
        spec: {
          nodeType: 'container',
          title: 'Node 1',
          parentName: 'node2',
        },
      };

      const circularNode2: ScopeNode = {
        metadata: { name: 'node2' },
        spec: {
          nodeType: 'container',
          title: 'Node 2',
          parentName: 'node1',
        },
      };

      (service as any).updateState({
        nodes: {
          node1: circularNode1,
          node2: circularNode2,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      // This should not hang or crash
      // Implementation should detect circular references and stop recursion
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await service.resolvePathToRoot('node1', tree);

      expect(result).toBeDefined();
      // When circular reference is detected, it returns partial path (up to the circular point)
      expect(result.path.length).toBeGreaterThan(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Circular reference detected in node path', expect.any(String));
      consoleErrorSpy.mockRestore();
    });

    it('should stop at root node (empty parentName)', async () => {
      (service as any).updateState({
        nodes: {
          parent: parentNode,
          child: childNode,
        },
      });

      const tree = {
        expanded: false,
        scopeNodeId: '',
        query: '',
        children: {},
      };

      const result = await service.resolvePathToRoot('child', tree);

      expect(result.path).toEqual([parentNode, childNode]);
      expect(result.path[0].spec.parentName).toBe('');
    });
  });

  describe('expandToSelectedScope (new helper method)', () => {
    beforeEach(() => {
      apiClient.fetchNodes = jest.fn().mockImplementation((options) => {
        // Return children based on parent
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent') {
          return Promise.resolve([childNode]);
        }
        return Promise.resolve([]);
      });
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([parentNode, childNode]);
    });

    it('should expand tree to show selected scope path', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child'],
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
      });

      await service.open();

      // Tree should be expanded to show the path
      expect(service.state.tree.children?.['parent']?.expanded).toBe(true);
      expect(service.state.tree.children?.['parent']?.children?.['child']).toBeDefined();
    });

    it('should not expand when no scopes are selected', async () => {
      (service as any).updateState({
        selectedScopes: [],
        appliedScopes: [],
      });

      await service.open();

      // Root should have children loaded but not expanded beyond that
      expect(service.state.tree.children).toBeDefined();
    });

    it('should load children of the last node in the path', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child'],
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child', parentNodeId: 'parent' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child', parentNodeId: 'parent' }],
      });

      // Mock API to return path nodes
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([parentNode, childNode]);

      // Mock fetchNodes to return children of the last node
      apiClient.fetchNodes = jest.fn().mockImplementation((options) => {
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent') {
          return Promise.resolve([childNode]);
        }
        return Promise.resolve([]);
      });

      await service.open();

      // Should have loaded root children (called once during tree initialization)
      expect(apiClient.fetchNodes).toHaveBeenCalled();
      // Verify the path nodes were fetched (parent already in cache from fetchNodes, so only child is fetched)
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(['child']);
    });

    it('should handle errors gracefully when expanding', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child'],
          filters: [],
        },
      };

      (service as any).updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
      });

      // Mock API to fail
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      apiClient.fetchMultipleScopeNodes = jest.fn().mockRejectedValue(new Error('API Error'));

      // Should not crash
      await expect(service.open()).resolves.not.toThrow();
      expect(service.state.opened).toBe(true);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('integration - full path resolution flow', () => {
    it('should resolve path from defaultPath, insert into tree, and expand', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child', 'grandchild'],
          filters: [],
        },
      };

      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([parentNode, childNode, grandchildNode]);
      apiClient.fetchNodes = jest.fn().mockImplementation((options) => {
        // Return children based on parent
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent') {
          return Promise.resolve([childNode]);
        } else if (options.parent === 'child') {
          return Promise.resolve([grandchildNode]);
        }
        return Promise.resolve([]);
      });

      (service as any).updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'grandchild' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'grandchild' }],
      });

      await service.open();

      // Path should be resolved (parent already in cache from fetchNodes, so only child and grandchild are fetched)
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(['child', 'grandchild']);

      // Nodes should be in cache
      expect(service.state.nodes['parent']).toEqual(parentNode);
      expect(service.state.nodes['child']).toEqual(childNode);
      expect(service.state.nodes['grandchild']).toEqual(grandchildNode);

      // Tree should be expanded
      expect(service.state.tree.children?.['parent']?.expanded).toBe(true);
      expect(service.state.tree.children?.['parent']?.children?.['child']?.expanded).toBe(true);
    });

    it('should use cached nodes and avoid unnecessary API calls', async () => {
      const scope: Scope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          defaultPath: ['parent', 'child'],
          filters: [],
        },
      };

      // Pre-populate cache
      (service as any).updateState({
        scopes: { 'test-scope': scope },
        nodes: {
          parent: parentNode,
          child: childNode,
        },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
      });

      apiClient.fetchNodes = jest.fn().mockImplementation((options) => {
        // Return children based on parent
        if (options.parent === '') {
          return Promise.resolve([parentNode]);
        } else if (options.parent === 'parent') {
          return Promise.resolve([childNode]);
        }
        return Promise.resolve([]);
      });
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([]);

      await service.open();

      // Should not fetch nodes that are already cached
      expect(apiClient.fetchMultipleScopeNodes).not.toHaveBeenCalled();
    });
  });

  describe('getScopeNode - caching behavior', () => {
    it('should return cached node without API call', async () => {
      (service as any).updateState({
        nodes: {
          'test-node': childNode,
        },
      });

      const result = await service.getScopeNode('test-node');

      expect(result).toEqual(childNode);
      expect(apiClient.fetchScopeNode).not.toHaveBeenCalled();
    });

    it('should fetch and cache node when not in cache', async () => {
      apiClient.fetchScopeNode = jest.fn().mockResolvedValue(childNode);

      const result = await service.getScopeNode('test-node');

      expect(apiClient.fetchScopeNode).toHaveBeenCalledWith('test-node');
      expect(result).toEqual(childNode);
      // Node is cached using its metadata.name, not the requested ID
      expect(service.state.nodes['child']).toEqual(childNode);
    });

    it('should handle API errors gracefully', async () => {
      apiClient.fetchScopeNode = jest.fn().mockResolvedValue(undefined);

      const result = await service.getScopeNode('non-existent');

      expect(result).toBeUndefined();
      expect(service.state.nodes['non-existent']).toBeUndefined();
    });
  });
});
