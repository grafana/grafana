import { getBackendSrv, config } from '@grafana/runtime';

import { ScopesApiClient } from './ScopesApiClient';

// Mock the runtime dependencies
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  config: {
    featureToggles: {
      useMultipleScopeNodesEndpoint: true,
      useScopeSingleNodeEndpoint: true,
    },
  },
}));

jest.mock('@grafana/api-clients', () => ({
  getAPIBaseURL: jest.fn().mockReturnValue('/apis/scope.grafana.app/v0alpha1'),
}));

describe('ScopesApiClient', () => {
  let apiClient: ScopesApiClient;
  let mockBackendSrv: jest.Mocked<{ get: jest.Mock }>;

  beforeEach(() => {
    mockBackendSrv = {
      get: jest.fn(),
    };
    (getBackendSrv as jest.Mock).mockReturnValue(mockBackendSrv);
    apiClient = new ScopesApiClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchMultipleScopeNodes', () => {
    it('should fetch multiple nodes by names', async () => {
      const mockNodes = [
        {
          metadata: { name: 'node-1' },
          spec: { nodeType: 'container', title: 'Node 1', parentName: '' },
        },
        {
          metadata: { name: 'node-2' },
          spec: { nodeType: 'leaf', title: 'Node 2', parentName: 'node-1' },
        },
      ];

      mockBackendSrv.get.mockResolvedValue({ items: mockNodes });

      const result = await apiClient.fetchMultipleScopeNodes(['node-1', 'node-2']);

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        names: ['node-1', 'node-2'],
      });
      expect(result).toEqual(mockNodes);
    });

    it('should return empty array when names array is empty', async () => {
      const result = await apiClient.fetchMultipleScopeNodes([]);

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array when feature toggle is disabled', async () => {
      config.featureToggles.useMultipleScopeNodesEndpoint = false;

      const result = await apiClient.fetchMultipleScopeNodes(['node-1']);

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
      expect(result).toEqual([]);

      // Restore feature toggle
      config.featureToggles.useMultipleScopeNodesEndpoint = true;
    });

    it('should handle API errors gracefully', async () => {
      mockBackendSrv.get.mockRejectedValue(new Error('Network error'));

      const result = await apiClient.fetchMultipleScopeNodes(['node-1']);

      expect(result).toEqual([]);
    });

    it('should handle response with no items field', async () => {
      mockBackendSrv.get.mockResolvedValue({});

      const result = await apiClient.fetchMultipleScopeNodes(['node-1']);

      expect(result).toEqual([]);
    });

    it('should handle response with null items', async () => {
      mockBackendSrv.get.mockResolvedValue({ items: null });

      const result = await apiClient.fetchMultipleScopeNodes(['node-1']);

      expect(result).toEqual([]);
    });

    it('should handle large arrays of node names', async () => {
      const names = Array.from({ length: 100 }, (_, i) => `node-${i}`);
      const mockNodes = names.map((name) => ({
        metadata: { name },
        spec: { nodeType: 'leaf', title: name, parentName: '' },
      }));

      mockBackendSrv.get.mockResolvedValue({ items: mockNodes });

      const result = await apiClient.fetchMultipleScopeNodes(names);

      expect(result).toEqual(mockNodes);
      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        names,
      });
    });

    it('should pass through node names exactly as provided', async () => {
      const names = ['node-with-special-chars_123', 'node.with.dots', 'node-with-dashes'];
      mockBackendSrv.get.mockResolvedValue({ items: [] });

      await apiClient.fetchMultipleScopeNodes(names);

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        names,
      });
    });
  });

  describe('fetchScopeNode', () => {
    it('should fetch a single scope node by ID', async () => {
      const mockNode = {
        metadata: { name: 'test-node' },
        spec: { nodeType: 'leaf', title: 'Test Node', parentName: 'parent' },
      };

      mockBackendSrv.get.mockResolvedValue(mockNode);

      const result = await apiClient.fetchScopeNode('test-node');

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/scopenodes/test-node');
      expect(result).toEqual(mockNode);
    });

    it('should return undefined when feature toggle is disabled', async () => {
      config.featureToggles.useScopeSingleNodeEndpoint = false;

      const result = await apiClient.fetchScopeNode('test-node');

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      // Restore feature toggle
      config.featureToggles.useScopeSingleNodeEndpoint = true;
    });

    it('should return undefined on API error', async () => {
      mockBackendSrv.get.mockRejectedValue(new Error('Not found'));

      const result = await apiClient.fetchScopeNode('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('fetchNodes', () => {
    it('should fetch nodes with parent filter', async () => {
      const mockNodes = [
        {
          metadata: { name: 'child-1' },
          spec: { nodeType: 'leaf', title: 'Child 1', parentName: 'parent' },
        },
      ];

      mockBackendSrv.get.mockResolvedValue({ items: mockNodes });

      const result = await apiClient.fetchNodes({ parent: 'parent' });

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        parent: 'parent',
        query: undefined,
        limit: 1000,
      });
      expect(result).toEqual(mockNodes);
    });

    it('should fetch nodes with query filter', async () => {
      const mockNodes = [
        {
          metadata: { name: 'matching-node' },
          spec: { nodeType: 'leaf', title: 'Matching Node', parentName: '' },
        },
      ];

      mockBackendSrv.get.mockResolvedValue({ items: mockNodes });

      const result = await apiClient.fetchNodes({ query: 'matching' });

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        parent: undefined,
        query: 'matching',
        limit: 1000,
      });
      expect(result).toEqual(mockNodes);
    });

    it('should respect custom limit', async () => {
      mockBackendSrv.get.mockResolvedValue({ items: [] });

      await apiClient.fetchNodes({ limit: 50 });

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        parent: undefined,
        query: undefined,
        limit: 50,
      });
    });

    it('should throw error for invalid limit (too small)', async () => {
      await expect(apiClient.fetchNodes({ limit: 0 })).rejects.toThrow('Limit must be between 1 and 10000');
    });

    it('should throw error for invalid limit (too large)', async () => {
      await expect(apiClient.fetchNodes({ limit: 10001 })).rejects.toThrow('Limit must be between 1 and 10000');
    });

    it('should use default limit of 1000 when not specified', async () => {
      mockBackendSrv.get.mockResolvedValue({ items: [] });

      await apiClient.fetchNodes({});

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/find/scope_node_children', {
        parent: undefined,
        query: undefined,
        limit: 1000,
      });
    });

    it('should return empty array on API error', async () => {
      mockBackendSrv.get.mockRejectedValue(new Error('API Error'));

      const result = await apiClient.fetchNodes({ parent: 'test' });

      expect(result).toEqual([]);
    });
  });

  describe('fetchScope', () => {
    it('should fetch a scope by name', async () => {
      const mockScope = {
        metadata: { name: 'test-scope' },
        spec: {
          title: 'Test Scope',
          filters: [],
        },
      };

      mockBackendSrv.get.mockResolvedValue(mockScope);

      const result = await apiClient.fetchScope('test-scope');

      expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/scope.grafana.app/v0alpha1/scopes/test-scope');
      expect(result).toEqual(mockScope);
    });

    it('should return undefined on error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockBackendSrv.get.mockRejectedValue(new Error('Not found'));

      const result = await apiClient.fetchScope('non-existent');

      expect(result).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });

    it('should log error to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Not found');
      mockBackendSrv.get.mockRejectedValue(error);

      await apiClient.fetchScope('non-existent');

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchMultipleScopes', () => {
    it('should fetch multiple scopes in parallel', async () => {
      const mockScopes = [
        {
          metadata: { name: 'scope-1' },
          spec: { title: 'Scope 1', filters: [] },
        },
        {
          metadata: { name: 'scope-2' },
          spec: { title: 'Scope 2', filters: [] },
        },
      ];

      mockBackendSrv.get.mockResolvedValueOnce(mockScopes[0]).mockResolvedValueOnce(mockScopes[1]);

      const result = await apiClient.fetchMultipleScopes(['scope-1', 'scope-2']);

      expect(mockBackendSrv.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockScopes);
    });

    it('should filter out undefined scopes', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockScope = {
        metadata: { name: 'scope-1' },
        spec: { title: 'Scope 1', filters: [] },
      };

      mockBackendSrv.get.mockResolvedValueOnce(mockScope).mockRejectedValueOnce(new Error('Not found'));

      const result = await apiClient.fetchMultipleScopes(['scope-1', 'non-existent']);

      expect(result).toEqual([mockScope]);
      consoleErrorSpy.mockRestore();
    });

    it('should return empty array when no scopes provided', async () => {
      const result = await apiClient.fetchMultipleScopes([]);

      expect(result).toEqual([]);
      expect(mockBackendSrv.get).not.toHaveBeenCalled();
    });
  });

  describe('performance considerations', () => {
    it('should make single batched request with fetchMultipleScopeNodes', async () => {
      mockBackendSrv.get.mockResolvedValue({ items: [] });

      await apiClient.fetchMultipleScopeNodes(['node-1', 'node-2', 'node-3', 'node-4', 'node-5']);

      // Should make exactly 1 API call
      expect(mockBackendSrv.get).toHaveBeenCalledTimes(1);
    });

    it('should make N sequential requests with fetchScopeNode (old pattern)', async () => {
      mockBackendSrv.get.mockResolvedValue({
        metadata: { name: 'test' },
        spec: { nodeType: 'leaf', title: 'Test', parentName: '' },
      });

      // Simulate old pattern of fetching nodes one by one
      await Promise.all([
        apiClient.fetchScopeNode('node-1'),
        apiClient.fetchScopeNode('node-2'),
        apiClient.fetchScopeNode('node-3'),
        apiClient.fetchScopeNode('node-4'),
        apiClient.fetchScopeNode('node-5'),
      ]);

      // Should make 5 separate API calls
      expect(mockBackendSrv.get).toHaveBeenCalledTimes(5);
    });
  });
});
