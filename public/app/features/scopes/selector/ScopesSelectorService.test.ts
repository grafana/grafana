import { Scope, ScopeNode } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { ScopesSelectorService } from './ScopesSelectorService';

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

  const mockNode: ScopeNode = {
    metadata: { name: 'test-scope-node' },
    spec: { linkId: 'test-scope', linkType: 'scope', parentName: '', nodeType: 'leaf', title: 'test-scope-node' },
  };

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

    service = new ScopesSelectorService(apiClient, dashboardsService);
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
  });

  describe('changeScopes', () => {
    it('should apply the provided scope names', async () => {
      await service.changeScopes(['test-scope']);
      expect(service.state.appliedScopes).toEqual([{ scopeId: 'test-scope' }]);
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
});
