import { Scope, ScopeNode, Store } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { RECENT_SCOPES_KEY, ScopesSelectorService } from './ScopesSelectorService';
import { RecentScope } from './types';

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
      type: 'scope',
      description: 'test scope',
      category: 'scope',
      filters: [],
    },
  };

  const mockScope2: Scope = {
    metadata: {
      name: 'recent-scope',
    },
    spec: {
      title: 'test-scope',
      type: 'scope',
      category: 'scope',
      description: 'test scope',
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
      fetchDashboards: jest.fn(),
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

    it('should update node query and fetch children when query changes', async () => {
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
          type: 'scope',
          category: 'scope',
          description: 'test scope',
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
          type: 'scope',
          category: 'scope',
          description: 'test scope',
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
          type: 'scope',
          category: 'scope',
          description: 'test scope',
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
          type: 'scope',
          category: 'scope',
          description: 'valid scope',
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
          type: 'scope',
          category: 'scope',
          description: 'invalid scope 1',
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
          type: 'scope',
          category: 'scope',
          description: 'invalid scope 2',
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
});
