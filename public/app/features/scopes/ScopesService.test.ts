import { BehaviorSubject } from 'rxjs';

import { LocationService } from '@grafana/runtime';

import { ScopesService } from './ScopesService';
import { ScopesDashboardsService } from './dashboards/ScopesDashboardsService';
import { ScopesSelectorService, ScopesSelectorServiceState } from './selector/ScopesSelectorService';

jest.mock('./selector/ScopesSelectorService');
jest.mock('./dashboards/ScopesDashboardsService');

describe('ScopesService', () => {
  let service: ScopesService;
  let selectorService: jest.Mocked<ScopesSelectorService>;
  let dashboardsService: jest.Mocked<ScopesDashboardsService>;
  let locationService: jest.Mocked<LocationService>;
  let stateSubscription:
    | ((
        state: { appliedScopes: Array<{ scopeId: string; scopeNodeId?: string; parentNodeId?: string }> },
        prevState: { appliedScopes: Array<{ scopeId: string; scopeNodeId?: string; parentNodeId?: string }> }
      ) => void)
    | undefined;

  beforeEach(() => {
    stateSubscription = undefined;

    selectorService = {
      state: {
        appliedScopes: [],
        selectedScopes: [],
        scopes: {},
        nodes: {},
        loading: false,
        opened: false,
        loadingNodeName: undefined,
        tree: { scopeNodeId: '', expanded: false, query: '', children: {} },
      },
      stateObservable: new BehaviorSubject({
        appliedScopes: [],
        selectedScopes: [],
        scopes: {},
        nodes: {},
        loading: false,
        opened: false,
        loadingNodeName: undefined,
        tree: { scopeNodeId: '', expanded: false, query: '', children: {} },
      }),
      subscribeToState: jest.fn((callback) => {
        stateSubscription = callback;
        return { unsubscribe: jest.fn() };
      }),
      changeScopes: jest.fn(),
      resolvePathToRoot: jest.fn().mockResolvedValue({ path: [], tree: {} }),
    } as unknown as jest.Mocked<ScopesSelectorService>;

    dashboardsService = {
      state: {
        drawerOpened: false,
        dashboards: [],
        scopeNavigations: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        searchQuery: '',
      },
      stateObservable: new BehaviorSubject({
        drawerOpened: false,
        dashboards: [],
        scopeNavigations: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        searchQuery: '',
      }),
    } as unknown as jest.Mocked<ScopesDashboardsService>;

    locationService = {
      getLocation: jest.fn().mockReturnValue({
        pathname: '/test',
        search: '',
      }),
      getLocationObservable: jest.fn().mockReturnValue(
        new BehaviorSubject({
          pathname: '/test',
          search: '',
        })
      ),
      partial: jest.fn(),
    } as unknown as jest.Mocked<LocationService>;
  });

  describe('URL initialization', () => {
    it('should read scope_node from URL on init', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_node=node1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], undefined, 'node1');
    });

    it('should read scope_parent for backward compatibility', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], 'parent1', undefined);
    });

    it('should prefer scope_node when both scope_node and scope_parent exist', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_node=node1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      // Should call with parent1 as parentNodeId and node1 as scopeNodeId
      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], 'parent1', 'node1');
      // Should preload node1 (not parent1)
      expect(selectorService.resolvePathToRoot).toHaveBeenCalledWith('node1', expect.anything());
    });

    it('should preload scope_node when provided', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_node=node1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.resolvePathToRoot).toHaveBeenCalledWith('node1', expect.anything());
    });

    it('should fallback to preload scope_parent when scope_node is not provided', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.resolvePathToRoot).toHaveBeenCalledWith('parent1', expect.anything());
    });

    it('should handle multiple scopes from URL', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scopes=scope2&scope_node=node1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1', 'scope2'], undefined, 'node1');
    });
  });

  describe('URL synchronization', () => {
    beforeEach(() => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '',
      });
      service = new ScopesService(selectorService, dashboardsService, locationService);
    });

    it('should write scope_node to URL when scopes change', () => {
      if (!stateSubscription) {
        throw new Error('stateSubscription not set');
      }

      stateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        },
        {
          appliedScopes: [],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          scopes: ['scope1'],
          scope_node: 'node1',
          scope_parent: null,
        },
        true
      );
    });

    it('should reset scope_parent to null when writing URL', () => {
      if (!stateSubscription) {
        throw new Error('stateSubscription not set');
      }

      stateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1', parentNodeId: 'parent1' }],
        },
        {
          appliedScopes: [],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_parent: null,
        }),
        true
      );
    });

    it('should handle scopeNodeId changes without scope changes', () => {
      if (!stateSubscription) {
        throw new Error('stateSubscription not set');
      }

      stateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node2' }],
        },
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          scopes: ['scope1'],
          scope_node: 'node2',
          scope_parent: null,
        },
        true
      );
    });

    it('should handle missing scopeNodeId gracefully', () => {
      if (!stateSubscription) {
        throw new Error('stateSubscription not set');
      }

      stateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1' }],
        },
        {
          appliedScopes: [],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          scopes: ['scope1'],
          scope_node: null,
          scope_parent: null,
        },
        true
      );
    });

    it('should not update URL when scopes and scopeNodeId have not changed', () => {
      if (!stateSubscription) {
        throw new Error('stateSubscription not set');
      }

      jest.clearAllMocks();

      stateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        },
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        }
      );

      expect(locationService.partial).not.toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '',
      });
      service = new ScopesService(selectorService, dashboardsService, locationService);
    });

    it('should sync scopeNodeId when enabling scopes', () => {
      selectorService.state.appliedScopes = [{ scopeId: 'scope1', scopeNodeId: 'node1' }];

      service.setEnabled(true);

      expect(locationService.partial).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_node: 'node1',
        }),
        true
      );
    });

    it('should reset scope_parent when enabling scopes', () => {
      selectorService.state.appliedScopes = [{ scopeId: 'scope1', scopeNodeId: 'node1' }];

      service.setEnabled(true);

      expect(locationService.partial).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_parent: null,
        }),
        true
      );
    });
  });
});
