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
      fetchScopeNode: jest.fn().mockResolvedValue(mockNode),
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
      await service.removeAllScopes();
      expect(service.state.appliedScopes).toEqual([]);
    });

    it('should clear navigation scope when removing all scopes', async () => {
      await service.filterNode('', '');
      await service.selectScope('test-scope-node');
      await service.apply();
      await service.removeAllScopes();
      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith(undefined);
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
});
