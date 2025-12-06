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

/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: Tests access protected updateState method via (service as any) casting to set up test state
describe('ScopesSelectorService - defaultPath functionality', () => {
  let service: ScopesSelectorService;
  let apiClient: jest.Mocked<ScopesApiClient>;
  let dashboardsService: jest.Mocked<ScopesDashboardsService>;
  let store: Store;
  let storeValue: Record<string, unknown> = {};

  // Mock data representing a hierarchy: Region > Country > City > Datacenter
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
    metadata: {
      name: 'scope-sea-1',
    },
    spec: {
      title: 'Seattle Datacenter 1',
      defaultPath: ['region-us-west', 'country-usa', 'city-seattle', 'datacenter-sea-1'],
      filters: [],
    },
  };

  const scopeWithoutDefaultPath: Scope = {
    metadata: {
      name: 'scope-no-path',
    },
    spec: {
      title: 'Scope Without Path',
      filters: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (locationService.getLocation as jest.Mock).mockReturnValue({ pathname: '/some-page' });

    apiClient = {
      fetchScope: jest.fn(),
      fetchMultipleScopes: jest.fn().mockResolvedValue([]),
      fetchNodes: jest.fn(),
      fetchDashboards: jest.fn().mockResolvedValue([]),
      fetchScopeNavigations: jest.fn().mockResolvedValue([]),
      fetchMultipleScopeNodes: jest.fn().mockResolvedValue([]),
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

    it('should handle multiple scopes with different defaultPaths', async () => {
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

      // Should collect unique node IDs from both defaultPaths
      expect(apiClient.fetchMultipleScopeNodes).toHaveBeenCalledWith(
        expect.arrayContaining([
          'region-us-west',
          'country-usa',
          'city-seattle',
          'datacenter-sea-1',
          'city-portland',
          'datacenter-pdx-1',
        ])
      );
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
      apiClient.fetchNodes = jest.fn().mockResolvedValue([regionNode]);
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
});
