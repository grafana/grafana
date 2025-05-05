import { Scope } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { ScopesSelectorService } from './ScopesSelectorService';
import { Node, NodeReason, NodesMap } from './types';

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

  const mockNode: Node = {
    name: 'test-scope',
    title: 'Test Node',
    reason: NodeReason.Result,
    nodeType: 'container',
    expandable: true,
    selectable: false,
    expanded: false,
    query: '',
    nodes: {},
  };

  const mockNodesMap: NodesMap = {
    '': mockNode,
  };

  beforeEach(() => {
    apiClient = {
      fetchScope: jest.fn().mockResolvedValue(mockScope),
      fetchMultipleScopes: jest.fn().mockResolvedValue([{ scope: mockScope, path: ['', 'test-scope'] }]),
      fetchNode: jest.fn().mockResolvedValue(mockNodesMap),
      fetchDashboards: jest.fn().mockResolvedValue([]),
      fetchScopeNavigations: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ScopesApiClient>;

    dashboardsService = {
      fetchDashboards: jest.fn(),
    } as unknown as jest.Mocked<ScopesDashboardsService>;

    service = new ScopesSelectorService(apiClient, dashboardsService);
  });

  describe('updateNode', () => {
    it('should update node and fetch children when expanded', async () => {
      await service.updateNode([''], true, '');

      expect(apiClient.fetchNode).toHaveBeenCalledWith('', '');
      expect(service.state.nodes[''].expanded).toBe(true);
    });

    it('should update node query and fetch children when query changes', async () => {
      await service.updateNode([''], false, 'new-query');

      expect(apiClient.fetchNode).toHaveBeenCalledWith('', 'new-query');
    });

    it('should not fetch children when node is collapsed and query is unchanged', async () => {
      // First expand the node
      await service.updateNode([''], true, '');

      // Then collapse it
      await service.updateNode([''], false, '');

      // fetchNode should be called only once (for the expansion)
      expect(apiClient.fetchNode).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleNodeSelect', () => {
    it('should select a node when it is not selected', async () => {
      await service.updateNode([''], true, '');

      const rootNode = service.state.nodes[''];
      rootNode.nodes['test-scope'] = {
        ...mockNode,
        selectable: true,
        linkId: 'test-scope',
      };

      service.toggleNodeSelect({ path: ['', 'test-scope'] });

      expect(service.state.treeScopes).toEqual([
        {
          scopeName: 'test-scope',
          path: ['', 'test-scope'],
          title: 'Test Node',
        },
      ]);
      expect(apiClient.fetchScope).toHaveBeenCalledWith('test-scope');
    });

    it('should deselect a node when it is already selected', async () => {
      await service.updateNode([''], true, '');

      const rootNode = service.state.nodes[''];
      rootNode.nodes['test-scope'] = {
        ...mockNode,
        selectable: true,
        linkId: 'test-scope',
      };

      // Select the node
      service.toggleNodeSelect({ path: ['', 'test-scope'] });

      // Deselect the node
      service.toggleNodeSelect({ path: ['', 'test-scope'] });

      expect(service.state.treeScopes).toEqual([]);
    });

    it('should deselect a node by name', async () => {
      // Make the scope selected and applied
      await service.changeScopes(['test-scope']);

      // Deselect the node
      service.toggleNodeSelect({ scopeName: 'test-scope' });

      expect(service.state.treeScopes).toEqual([]);
    });
  });

  describe('changeScopes', () => {
    it('should update treeScopes with the provided scope names', () => {
      service.changeScopes(['test-scope']);

      expect(service.state.treeScopes).toEqual([
        {
          scopeName: 'test-scope',
          path: [],
          title: 'test-scope',
        },
      ]);
    });
  });

  describe('open', () => {
    it('should open the selector and load root nodes if not loaded', async () => {
      await service.open();

      expect(service.state.opened).toBe(true);
    });

    it('should not reload root nodes if already loaded', async () => {
      // First load the nodes
      await service.updateNode([''], true, '');

      // Reset the mock to check if it's called again
      apiClient.fetchNode.mockClear();

      // Open the selector
      await service.open();

      expect(service.state.opened).toBe(true);
    });
  });

  describe('closeAndReset', () => {
    it('should close the selector and reset treeScopes to match selectedScopes', async () => {
      // Setup: Open the selector and select a scope
      await service.open();

      await service.changeScopes(['test-scope']);

      service.closeAndReset();

      expect(service.state.opened).toBe(false);
      expect(service.state.treeScopes).toEqual([
        {
          scopeName: 'test-scope',
          path: ['', 'test-scope'],
          title: 'test-scope',
        },
      ]);
    });
  });

  describe('closeAndApply', () => {
    it('should close the selector and apply the selected scopes', async () => {
      await service.open();

      const rootNode = service.state.nodes[''];
      rootNode.nodes['test-scope'] = {
        ...mockNode,
        selectable: true,
        linkId: 'test-scope',
      };

      service.toggleNodeSelect({ path: ['', 'test-scope'] });
      await service.closeAndApply();

      expect(service.state.opened).toBe(false);
      expect(dashboardsService.fetchDashboards).toHaveBeenCalledWith(['test-scope']);
    });
  });

  describe('apply', () => {
    it('should apply the selected scopes without closing the selector', async () => {
      await service.open();

      const rootNode = service.state.nodes[''];
      rootNode.nodes['test-scope'] = {
        ...mockNode,
        selectable: true,
        linkId: 'test-scope',
      };

      service.toggleNodeSelect({ path: ['', 'test-scope'] });
      await service.apply();

      expect(service.state.opened).toBe(true);
      expect(dashboardsService.fetchDashboards).toHaveBeenCalledWith(['test-scope']);
    });
  });

  describe('resetSelection', () => {
    it('should reset treeScopes to match selectedScopes', async () => {
      await service.open();
      await service.changeScopes(['test-scope']);

      service.resetSelection();
      expect(service.state.treeScopes).toEqual([
        {
          scopeName: 'test-scope',
          path: ['', 'test-scope'],
          title: 'test-scope',
        },
      ]);
    });
  });

  describe('removeAllScopes', () => {
    it('should remove all selected scopes', async () => {
      await service.open();

      const rootNode = service.state.nodes[''];
      rootNode.nodes['test-scope'] = {
        ...mockNode,
        selectable: true,
        linkId: 'test-scope',
      };

      service.toggleNodeSelect({ path: ['', 'test-scope'] });
      await service.apply();
      await service.removeAllScopes();

      expect(service.state.selectedScopes).toEqual([]);
      expect(service.state.treeScopes).toEqual([]);
    });
  });
});
