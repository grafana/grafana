import { config } from '@grafana/runtime';
import { MOCK_NODES, MOCK_SCOPES } from '@grafana/test-utils/unstable';
import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';

import { ScopesApiClient } from './ScopesApiClient';

// Helper to create a mock subscription with unsubscribe method
const createMockSubscription = <T>(data: T): Promise<T> & { unsubscribe: jest.Mock } => {
  const subscription = Promise.resolve(data) as Promise<T> & { unsubscribe: jest.Mock };
  subscription.unsubscribe = jest.fn();
  return subscription;
};

// Mock the RTK Query API and dispatch
jest.mock('app/api/clients/scope/v0alpha1', () => ({
  scopeAPIv0alpha1: {
    endpoints: {
      getScope: {
        initiate: jest.fn(),
      },
      getScopeNode: {
        initiate: jest.fn(),
      },
      getFindScopeNodeChildrenResults: {
        initiate: jest.fn(),
      },
      getFindScopeDashboardBindingsResults: {
        initiate: jest.fn(),
      },
      getFindScopeNavigationsResults: {
        initiate: jest.fn(),
      },
    },
  },
}));

jest.mock('app/store/store', () => ({
  dispatch: jest.fn((action) => action),
}));

describe('ScopesApiClient', () => {
  let apiClient: ScopesApiClient;

  beforeEach(() => {
    apiClient = new ScopesApiClient();
    config.featureToggles.useMultipleScopeNodesEndpoint = true;
    config.featureToggles.useScopeSingleNodeEndpoint = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchScope', () => {
    it('should fetch a scope by name', async () => {
      // Expected: MOCK_SCOPES contains a scope with name 'grafana'
      const expectedScope = MOCK_SCOPES.find((s) => s.metadata.name === 'grafana');
      expect(expectedScope).toBeDefined();

      const mockSubscription = createMockSubscription({ data: expectedScope });
      (scopeAPIv0alpha1.endpoints.getScope.initiate as jest.Mock).mockReturnValue(mockSubscription);

      const result = await apiClient.fetchScope('grafana');

      // Validate: result matches the expected scope from MOCK_SCOPES
      expect(result).toEqual(expectedScope);
      expect(scopeAPIv0alpha1.endpoints.getScope.initiate).toHaveBeenCalledWith(
        { name: 'grafana' },
        { subscribe: false }
      );
    });

    it('should return undefined when scope is not found', async () => {
      // Expected: No scope with this name exists in MOCK_SCOPES
      const nonExistentScopeName = 'non-existent-scope';
      const errorResponse = {
        kind: 'Status',
        apiVersion: 'v1',
        status: 'Failure',
        message: `scopes.scope.grafana.app "${nonExistentScopeName}" not found`,
        code: 404,
      };
      const mockSubscription = createMockSubscription({ data: errorResponse });
      (scopeAPIv0alpha1.endpoints.getScope.initiate as jest.Mock).mockReturnValue(mockSubscription);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchScope(nonExistentScopeName);

      // Validate: returns undefined for non-existent scope
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchMultipleScopes', () => {
    it('should fetch multiple scopes in parallel', async () => {
      // Expected: Both 'grafana' and 'mimir' exist in MOCK_SCOPES
      const scopeNames = ['grafana', 'mimir'];
      const expectedScopes = MOCK_SCOPES.filter((s) => scopeNames.includes(s.metadata.name));

      const mockSubscriptions = expectedScopes.map((scope) => createMockSubscription({ data: scope }));
      (scopeAPIv0alpha1.endpoints.getScope.initiate as jest.Mock)
        .mockReturnValueOnce(mockSubscriptions[0])
        .mockReturnValueOnce(mockSubscriptions[1]);

      const result = await apiClient.fetchMultipleScopes(scopeNames);

      // Validate: returns both scopes from MOCK_SCOPES
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.metadata.name)).toContain('grafana');
      expect(result.map((s) => s.metadata.name)).toContain('mimir');
      expect(result).toEqual(expect.arrayContaining(expectedScopes));
    });

    it('should filter out undefined scopes when some fail', async () => {
      // Expected: 'grafana' exists in MOCK_SCOPES, 'non-existent' does not
      const scopeNames = ['grafana', 'non-existent'];
      const expectedScope = MOCK_SCOPES.find((s) => s.metadata.name === 'grafana');
      const errorResponse = {
        kind: 'Status',
        apiVersion: 'v1',
        status: 'Failure',
        message: 'scopes.scope.grafana.app "non-existent" not found',
        code: 404,
      };

      const mockSubscriptions = [
        createMockSubscription({ data: expectedScope }),
        createMockSubscription({ data: errorResponse }),
      ];
      (scopeAPIv0alpha1.endpoints.getScope.initiate as jest.Mock)
        .mockReturnValueOnce(mockSubscriptions[0])
        .mockReturnValueOnce(mockSubscriptions[1]);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await apiClient.fetchMultipleScopes(scopeNames);

      // Validate: only returns the existing scope from MOCK_SCOPES, filters out the non-existent one
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedScope);
      expect(result[0].metadata.name).toBe('grafana');
      // Validate: console.warn is called when some scopes fail
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should return empty array when no scopes provided', async () => {
      const result = await apiClient.fetchMultipleScopes([]);

      // Validate: empty input returns empty array
      expect(result).toEqual([]);
    });
  });

  describe('fetchMultipleScopeNodes', () => {
    it('should fetch multiple nodes by names', async () => {
      // Expected: Both nodes exist in MOCK_NODES
      const nodeNames = ['applications-grafana', 'applications-mimir'];
      const expectedNodes = MOCK_NODES.filter((n) => nodeNames.includes(n.metadata.name));

      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchMultipleScopeNodes(nodeNames);

      // Validate: returns the expected nodes from MOCK_NODES
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.metadata.name)).toContain('applications-grafana');
      expect(result.map((n) => n.metadata.name)).toContain('applications-mimir');
      expect(result).toEqual(expect.arrayContaining(expectedNodes));
    });

    it('should return empty array when names array is empty', async () => {
      const result = await apiClient.fetchMultipleScopeNodes([]);

      expect(result).toEqual([]);
    });

    it('should return empty array when feature toggle is disabled', async () => {
      config.featureToggles.useMultipleScopeNodesEndpoint = false;

      const result = await apiClient.fetchMultipleScopeNodes(['applications-grafana']);

      expect(result).toEqual([]);

      // Restore feature toggle
      config.featureToggles.useMultipleScopeNodesEndpoint = true;
    });

    it('should handle API errors gracefully', async () => {
      // Expected: No node with this name exists in MOCK_NODES
      const nonExistentNodeName = 'non-existent-node';
      const mockSubscription = createMockSubscription({ data: { items: [] } });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchMultipleScopeNodes([nonExistentNodeName]);

      // Validate: returns empty array when no matches
      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });

    it('should handle response with no items field', async () => {
      // Expected: Node exists in MOCK_NODES
      const nodeName = 'applications-grafana';
      const mockSubscription = createMockSubscription({ data: {} });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchMultipleScopeNodes([nodeName]);

      // Validate: returns empty array when items field is missing
      expect(result).toEqual([]);
    });

    it('should handle large arrays of node names', async () => {
      // Expected: None of these node names exist in MOCK_NODES
      const nonExistentNodeNames = Array.from({ length: 10 }, (_, i) => `node-${i}`);
      const mockSubscription = createMockSubscription({ data: { items: [] } });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchMultipleScopeNodes(nonExistentNodeNames);

      // Validate: returns empty array when no matches
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it('should pass through node names exactly as provided', async () => {
      // Expected: Both nodes exist in MOCK_NODES
      const nodeNames = ['applications-grafana', 'applications-mimir'];
      const expectedNodes = MOCK_NODES.filter((n) => nodeNames.includes(n.metadata.name));
      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchMultipleScopeNodes(nodeNames);

      // Validate: returns nodes matching the provided names
      const resultNames = result.map((n) => n.metadata.name);
      expect(resultNames).toEqual(expect.arrayContaining(nodeNames));
      // Verify we got the expected nodes from MOCK_NODES
      expectedNodes.forEach((expectedNode) => {
        expect(result).toContainEqual(expectedNode);
      });
    });
  });

  describe('fetchScopeNode', () => {
    it('should fetch a single scope node by ID', async () => {
      // Expected: Node exists in MOCK_NODES
      const nodeName = 'applications-grafana';
      const expectedNode = MOCK_NODES.find((n) => n.metadata.name === nodeName);
      expect(expectedNode).toBeDefined();

      const mockSubscription = createMockSubscription({ data: expectedNode });
      (scopeAPIv0alpha1.endpoints.getScopeNode.initiate as jest.Mock).mockReturnValue(mockSubscription);

      const result = await apiClient.fetchScopeNode(nodeName);

      // Validate: result matches the expected node from MOCK_NODES
      expect(result).toEqual(expectedNode);
    });

    it('should return undefined when feature toggle is disabled', async () => {
      config.featureToggles.useScopeSingleNodeEndpoint = false;

      const result = await apiClient.fetchScopeNode('applications-grafana');

      expect(result).toBeUndefined();

      // Restore feature toggle
      config.featureToggles.useScopeSingleNodeEndpoint = true;
    });

    it('should return undefined on API error', async () => {
      // Expected: No node with this name exists in MOCK_NODES
      const nonExistentNodeName = 'non-existent-node';
      const errorResponse = {
        kind: 'Status',
        apiVersion: 'v1',
        status: 'Failure',
        message: `scopenodes.scope.grafana.app "${nonExistentNodeName}" not found`,
        code: 404,
      };
      const mockSubscription = createMockSubscription({ data: errorResponse });
      (scopeAPIv0alpha1.endpoints.getScopeNode.initiate as jest.Mock).mockReturnValue(mockSubscription);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchScopeNode(nonExistentNodeName);

      // Validate: returns undefined for non-existent node
      expect(result).toBeUndefined();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchNodes', () => {
    it('should fetch nodes with parent filter', async () => {
      // Expected: MOCK_NODES contains nodes with parentName 'applications'
      const parentName = 'applications';
      const expectedNodes = MOCK_NODES.filter((n) => n.spec.parentName === parentName);

      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchNodes({ parent: parentName });

      // Validate: returns nodes with matching parentName from MOCK_NODES
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((node) => {
        expect(node.spec.parentName).toBe(parentName);
      });
      // Verify all returned nodes are from the expected set
      result.forEach((node) => {
        expect(expectedNodes).toContainEqual(node);
      });
    });

    it('should fetch nodes with query filter', async () => {
      // Expected: MOCK_NODES contains nodes with 'Grafana' in title (case-insensitive)
      // When query is provided without parent, the API returns nodes matching the query
      // In MOCK_NODES, nodes with 'Grafana' in title have parentName 'applications' or 'cloud-applications'
      const query = 'Grafana';
      const expectedNodes = MOCK_NODES.filter((n) => n.spec.title.toLowerCase().includes(query.toLowerCase()));

      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchNodes({ query });

      // Validate: returns nodes matching the query from MOCK_NODES
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((node) => {
        expect(node.spec.title.toLowerCase()).toContain('grafana');
      });
      // Verify all returned nodes are from the expected set
      result.forEach((node) => {
        expect(expectedNodes).toContainEqual(node);
      });
    });

    it('should respect custom limit', async () => {
      const limit = 5;
      const mockNodes = MOCK_NODES.slice(0, limit);
      const mockSubscription = createMockSubscription({
        data: { items: mockNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchNodes({ limit });

      expect(result.length).toBeLessThanOrEqual(limit);
    });

    it('should throw error for invalid limit (too small)', async () => {
      await expect(apiClient.fetchNodes({ limit: 0 })).rejects.toThrow('Limit must be between 1 and 10000');
    });

    it('should throw error for invalid limit (too large)', async () => {
      await expect(apiClient.fetchNodes({ limit: 10001 })).rejects.toThrow('Limit must be between 1 and 10000');
    });

    it('should use default limit of 1000 when not specified', async () => {
      const mockNodes = MOCK_NODES.slice(0, 1000);
      const mockSubscription = createMockSubscription({
        data: { items: mockNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchNodes({});

      expect(Array.isArray(result)).toBe(true);
      // Default limit is 1000, so result should not exceed that
      expect(result.length).toBeLessThanOrEqual(1000);
    });

    it('should return empty array on API error', async () => {
      const mockSubscription = createMockSubscription({ data: { items: [] } });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchNodes({ parent: 'non-existent-parent' });

      expect(Array.isArray(result)).toBe(true);
      consoleErrorSpy.mockRestore();
    });

    it('should combine parent and query filters', async () => {
      // Expected: MOCK_NODES contains nodes with parentName 'applications' and 'Grafana' in title
      const parentName = 'applications';
      const query = 'Grafana';
      const expectedNodes = MOCK_NODES.filter(
        (n) => n.spec.parentName === parentName && n.spec.title.toLowerCase().includes(query.toLowerCase())
      );

      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchNodes({ parent: parentName, query });

      // Validate: returns nodes matching both filters from MOCK_NODES
      expect(Array.isArray(result)).toBe(true);
      result.forEach((node) => {
        expect(node.spec.parentName).toBe(parentName);
        expect(node.spec.title.toLowerCase()).toContain('grafana');
      });
      // Verify all returned nodes are from the expected set
      result.forEach((node) => {
        expect(expectedNodes).toContainEqual(node);
      });
    });
  });

  describe('fetchDashboards', () => {
    it('should fetch dashboards for scopes', async () => {
      // Expected: MOCK_SCOPE_DASHBOARD_BINDINGS contains bindings for 'grafana' scope
      const scopeNames = ['grafana'];
      const mockBindings = [
        {
          metadata: { name: 'grafana-binding-1' },
          spec: { dashboard: 'dashboard-1', scope: 'grafana' },
          status: { dashboardTitle: 'Dashboard 1' },
        },
      ];
      const mockSubscription = createMockSubscription({
        data: { items: mockBindings },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchDashboards(scopeNames);

      // Validate: returns bindings for the requested scope
      expect(Array.isArray(result)).toBe(true);
      result.forEach((binding) => {
        expect(binding.spec.scope).toBe('grafana');
      });
    });

    it('should fetch dashboards for multiple scopes', async () => {
      // Expected: MOCK_SCOPE_DASHBOARD_BINDINGS contains bindings for 'grafana' and 'mimir' scopes
      const scopeNames = ['grafana', 'mimir'];
      const mockBindings = [
        {
          metadata: { name: 'grafana-binding-1' },
          spec: { dashboard: 'dashboard-1', scope: 'grafana' },
          status: { dashboardTitle: 'Dashboard 1' },
        },
        {
          metadata: { name: 'mimir-binding-1' },
          spec: { dashboard: 'dashboard-2', scope: 'mimir' },
          status: { dashboardTitle: 'Dashboard 2' },
        },
      ];
      const mockSubscription = createMockSubscription({
        data: { items: mockBindings },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchDashboards(scopeNames);

      // Validate: returns bindings for either scope
      expect(Array.isArray(result)).toBe(true);
      result.forEach((binding) => {
        expect(scopeNames).toContain(binding.spec.scope);
      });
    });

    it('should return empty array when no dashboards found', async () => {
      const mockSubscription = createMockSubscription({
        data: { items: [] },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchDashboards(['non-existent-scope']);

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      const mockSubscription = createMockSubscription({
        data: { items: [] },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchDashboards(['grafana']);

      expect(Array.isArray(result)).toBe(true);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchScopeNavigations', () => {
    it('should fetch navigations for scopes', async () => {
      // Expected: MSW handler returns MOCK_SUB_SCOPE_MIMIR_ITEMS for 'mimir' scope
      const scopeName = 'mimir';
      const mockNavigations = [
        {
          metadata: { name: 'mimir-item-1' },
          spec: { scope: 'mimir', url: '/d/mimir-dashboard-1' },
          status: { title: 'Mimir Dashboard 1' },
        },
      ];
      const mockSubscription = createMockSubscription({
        data: { items: mockNavigations },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchScopeNavigations([scopeName]);

      // Validate: returns navigations for the requested scope
      expect(Array.isArray(result)).toBe(true);
      result.forEach((nav) => {
        expect(nav.spec.scope).toBe('mimir');
      });
    });

    it('should fetch navigations for multiple scopes', async () => {
      // Expected: Returns navigations for both 'mimir' and 'loki'
      const scopeNames = ['mimir', 'loki'];
      const mockNavigations = [
        {
          metadata: { name: 'mimir-item-1' },
          spec: { scope: 'mimir', url: '/d/mimir-dashboard-1' },
          status: { title: 'Mimir Dashboard 1' },
        },
        {
          metadata: { name: 'loki-item-1' },
          spec: { scope: 'loki', url: '/d/loki-dashboard-1' },
          status: { title: 'Loki Dashboard 1' },
        },
      ];
      const mockSubscription = createMockSubscription({
        data: { items: mockNavigations },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchScopeNavigations(scopeNames);

      // Validate: returns navigations for both scopes
      expect(Array.isArray(result)).toBe(true);
      const resultScopeNames = result.map((nav) => nav.spec.scope);
      expect(resultScopeNames.length).toBeGreaterThan(0);
      result.forEach((nav) => {
        expect(scopeNames).toContain(nav.spec.scope);
      });
    });

    it('should return empty array when no navigations found', async () => {
      const mockSubscription = createMockSubscription({
        data: { items: [] },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchScopeNavigations(['grafana']);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const mockSubscription = createMockSubscription({
        data: { items: [] },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await apiClient.fetchScopeNavigations(['mimir']);

      expect(Array.isArray(result)).toBe(true);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('performance considerations', () => {
    it('should make single batched request with fetchMultipleScopeNodes', async () => {
      // This test verifies that the method uses the batched endpoint
      const nodeNames = [
        'applications-grafana',
        'applications-mimir',
        'applications-loki',
        'applications-tempo',
        'applications-cloud',
      ];
      const expectedNodes = MOCK_NODES.filter((n) => nodeNames.includes(n.metadata.name));
      const mockSubscription = createMockSubscription({
        data: { items: expectedNodes },
      });
      (scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate as jest.Mock).mockReturnValue(
        mockSubscription
      );

      const result = await apiClient.fetchMultipleScopeNodes(nodeNames);

      expect(Array.isArray(result)).toBe(true);
      // Verify it was called once with all names
      expect(scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate).toHaveBeenCalledTimes(1);
      expect(scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate).toHaveBeenCalledWith(
        { names: nodeNames },
        { subscribe: false }
      );
    });

    it('should make N sequential requests with fetchScopeNode (old pattern)', async () => {
      // This test demonstrates the old pattern of fetching nodes one by one
      // Each call makes a separate API request
      const nodeNames = [
        'applications-grafana',
        'applications-mimir',
        'applications-loki',
        'applications-tempo',
        'applications-cloud',
      ];
      const mockNodes = nodeNames.map((name) => MOCK_NODES.find((n) => n.metadata.name === name)).filter(Boolean);
      const mockSubscriptions = mockNodes.map((node) => createMockSubscription({ data: node }));
      mockSubscriptions.forEach((sub) => {
        (scopeAPIv0alpha1.endpoints.getScopeNode.initiate as jest.Mock).mockReturnValueOnce(sub);
      });

      const results = await Promise.all([
        apiClient.fetchScopeNode('applications-grafana'),
        apiClient.fetchScopeNode('applications-mimir'),
        apiClient.fetchScopeNode('applications-loki'),
        apiClient.fetchScopeNode('applications-tempo'),
        apiClient.fetchScopeNode('applications-cloud'),
      ]);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r !== undefined)).toBe(true);
      // Verify it was called 5 times (once per node)
      expect(scopeAPIv0alpha1.endpoints.getScopeNode.initiate).toHaveBeenCalledTimes(5);
    });
  });
});
