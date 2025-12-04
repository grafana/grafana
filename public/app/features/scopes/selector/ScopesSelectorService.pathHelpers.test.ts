import { Scope, ScopeNode, Store } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { ScopesSelectorService } from './ScopesSelectorService';

// Mock locationService
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getLocation: jest.fn(),
  },
}));

/**
 * Tests for the refactored path resolution helper methods
 * These tests focus on the new centralized logic for path determination and expansion
 */
describe('ScopesSelectorService - Path Helper Methods', () => {
  let service: ScopesSelectorService;
  let apiClient: jest.Mocked<ScopesApiClient>;
  let dashboardsService: jest.Mocked<ScopesDashboardsService>;
  let store: Store;
  let storeValue: Record<string, unknown> = {};

  const parentNode: ScopeNode = {
    metadata: { name: 'parent' },
    spec: {
      nodeType: 'container',
      title: 'Parent',
      parentName: '',
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

  beforeEach(() => {
    jest.clearAllMocks();
    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-page' });

    apiClient = {
      fetchScope: jest.fn(),
      fetchMultipleScopes: jest.fn(),
      fetchNodes: jest.fn(),
      fetchDashboards: jest.fn().mockResolvedValue([]),
      fetchScopeNavigations: jest.fn().mockResolvedValue([]),
      fetchMultipleScopeNodes: jest.fn(),
      fetchScopeNode: jest.fn(),
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

      service.updateState({
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

      service.updateState({
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

      service.updateState({
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
      service.updateState({
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
      service.updateState({
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

      service.updateState({
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
      // Implementation should detect circular references
      await expect(service.resolvePathToRoot('node1', tree)).resolves.toBeDefined();
    });

    it('should stop at root node (empty parentName)', async () => {
      service.updateState({
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
      apiClient.fetchNodes = jest.fn().mockResolvedValue([parentNode]);
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

      service.updateState({
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
      service.updateState({
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

      service.updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child', parentNodeId: 'parent' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child', parentNodeId: 'parent' }],
      });

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

      // Should have loaded children of parent node
      expect(apiClient.fetchNodes).toHaveBeenCalledWith({ parent: 'parent', query: '' });
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

      service.updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
      });

      // Mock API to fail
      apiClient.fetchMultipleScopeNodes = jest.fn().mockRejectedValue(new Error('API Error'));

      // Should not crash
      await expect(service.open()).resolves.not.toThrow();
      expect(service.state.opened).toBe(true);
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
      apiClient.fetchNodes = jest.fn().mockResolvedValue([parentNode]);

      service.updateState({
        scopes: { 'test-scope': scope },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'grandchild' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'grandchild' }],
      });

      await service.open();

      // Path should be resolved
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(['parent', 'child', 'grandchild']);

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
      service.updateState({
        scopes: { 'test-scope': scope },
        nodes: {
          parent: parentNode,
          child: childNode,
        },
        selectedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
        appliedScopes: [{ scopeId: 'test-scope', scopeNodeId: 'child' }],
      });

      apiClient.fetchNodes = jest.fn().mockResolvedValue([parentNode]);
      apiClient.fetchMultipleScopeNodes = jest.fn().mockResolvedValue([]);

      await service.open();

      // Should not fetch nodes that are already cached
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith([]);
    });
  });

  describe('getScopeNode - caching behavior', () => {
    it('should return cached node without API call', async () => {
      service.updateState({
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
      expect(service.state.nodes['test-node']).toEqual(childNode);
    });

    it('should handle API errors gracefully', async () => {
      apiClient.fetchScopeNode = jest.fn().mockResolvedValue(undefined);

      const result = await service.getScopeNode('non-existent');

      expect(result).toBeUndefined();
      expect(service.state.nodes['non-existent']).toBeUndefined();
    });
  });
});
