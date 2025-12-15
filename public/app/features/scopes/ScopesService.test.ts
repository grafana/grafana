import { BehaviorSubject } from 'rxjs';

import { LocationService } from '@grafana/runtime';

import { ScopesService } from './ScopesService';
import { ScopesDashboardsService } from './dashboards/ScopesDashboardsService';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

jest.mock('./selector/ScopesSelectorService');
jest.mock('./dashboards/ScopesDashboardsService');

describe('ScopesService', () => {
  let service: ScopesService;
  let selectorService: jest.Mocked<ScopesSelectorService>;
  let dashboardsService: jest.Mocked<ScopesDashboardsService>;
  let locationService: jest.Mocked<LocationService>;
  let selectorStateSubscription:
    | ((
        state: { appliedScopes: Array<{ scopeId: string; scopeNodeId?: string; parentNodeId?: string }> },
        prevState: { appliedScopes: Array<{ scopeId: string; scopeNodeId?: string; parentNodeId?: string }> }
      ) => void)
    | undefined;
  let dashboardsStateSubscription:
    | ((
        state: { navigationScope?: string; drawerOpened: boolean; navScopePath?: string[] },
        prevState: { navigationScope?: string; drawerOpened: boolean; navScopePath?: string[] }
      ) => void)
    | undefined;

  beforeEach(() => {
    selectorStateSubscription = undefined;
    dashboardsStateSubscription = undefined;

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
        selectorStateSubscription = callback;
        return { unsubscribe: jest.fn() };
      }),
      changeScopes: jest.fn().mockResolvedValue(undefined),
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
        navigationScope: undefined,
        navScopePath: undefined,
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
        navigationScope: undefined,
        navScopePath: undefined,
      }),
      subscribeToState: jest.fn((callback) => {
        dashboardsStateSubscription = callback;
        return { unsubscribe: jest.fn() };
      }),
      setNavigationScope: jest.fn(),
      setNavScopePath: jest.fn(),
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

      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], undefined, 'node1', false);
    });

    // TODO: remove when parentNodeId is removed
    it('should ignore scope_parent from URL (only used for recent scopes)', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      // parentNodeId should be undefined since we don't read it from URL
      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], undefined, undefined, false);
    });

    // TODO: remove when parentNodeId is removed
    it('should only use scope_node when both scope_node and scope_parent exist in URL', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_node=node1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      // Should only use scopeNodeId from URL, parentNodeId is undefined
      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], undefined, 'node1', false);
      // Should preload node1
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

    // TODO: remove when parentNodeId is removed
    it('should not preload when only scope_parent is in URL', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_parent=parent1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      // Should not preload since we don't read scope_parent from URL
      expect(selectorService.resolvePathToRoot).not.toHaveBeenCalled();
    });

    it('should handle multiple scopes from URL', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scopes=scope2&scope_node=node1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1', 'scope2'], undefined, 'node1', false);
    });

    it('should read navigation_scope from URL on init', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&navigation_scope=navScope1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope1', undefined, undefined);
    });

    it('should read navigation_scope along with other scope parameters', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&scope_node=node1&navigation_scope=navScope1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope1', undefined, undefined);
      expect(selectorService.changeScopes).toHaveBeenCalledWith(['scope1'], undefined, 'node1', false);
    });

    it('should not call setNavigationScope when navigation_scope is not in URL', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(dashboardsService.setNavigationScope).not.toHaveBeenCalled();
    });

    it('should read nav_scope_path along with navigation_scope from URL on init', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?navigation_scope=navScope1&nav_scope_path=mimir%2Cloki',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope1', undefined, ['mimir', 'loki']);
    });

    it('should handle nav_scope_path without navigation_scope by calling setNavScopePath after changeScopes', async () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?scopes=scope1&nav_scope_path=mimir',
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      // Wait for the changeScopes promise to resolve
      await Promise.resolve();

      expect(dashboardsService.setNavScopePath).toHaveBeenCalledWith(['mimir']);
    });

    it('should handle URL-encoded nav_scope_path values', () => {
      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '?navigation_scope=navScope1&nav_scope_path=' + encodeURIComponent('folder one,folder two'),
      });

      service = new ScopesService(selectorService, dashboardsService, locationService);

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope1', undefined, [
        'folder one',
        'folder two',
      ]);
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
      if (!selectorStateSubscription) {
        throw new Error('selectorStateSubscription not set');
      }

      selectorStateSubscription(
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
      if (!selectorStateSubscription) {
        throw new Error('selectorStateSubscription not set');
      }

      selectorStateSubscription(
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
      if (!selectorStateSubscription) {
        throw new Error('selectorStateSubscription not set');
      }

      selectorStateSubscription(
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
      if (!selectorStateSubscription) {
        throw new Error('selectorStateSubscription not set');
      }

      selectorStateSubscription(
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
      if (!selectorStateSubscription) {
        throw new Error('selectorStateSubscription not set');
      }

      jest.clearAllMocks();

      selectorStateSubscription(
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        },
        {
          appliedScopes: [{ scopeId: 'scope1', scopeNodeId: 'node1' }],
        }
      );

      expect(locationService.partial).not.toHaveBeenCalled();
    });

    it('should write navigation_scope to URL when navigationScope changes', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: undefined,
        },
        {
          navigationScope: undefined,
          drawerOpened: false,
          navScopePath: undefined,
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: 'navScope1',
          nav_scope_path: null,
        },
        true
      );
    });

    it('should update navigation_scope in URL when navigationScope changes', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope2',
          drawerOpened: true,
          navScopePath: undefined,
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: undefined,
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: 'navScope2',
          nav_scope_path: null,
        },
        true
      );
    });

    it('should not update URL when navigationScope has not changed', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      jest.clearAllMocks();

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: undefined,
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: false,
          navScopePath: undefined,
        }
      );

      expect(locationService.partial).not.toHaveBeenCalled();
    });

    it('should clear navigation_scope from URL when navigationScope is cleared', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: undefined,
          drawerOpened: false,
          navScopePath: undefined,
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: undefined,
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: null,
          nav_scope_path: null,
        },
        true
      );
    });

    it('should write nav_scope_path to URL when navScopePath changes', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: ['mimir', 'loki'],
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: undefined,
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: 'navScope1',
          nav_scope_path: encodeURIComponent('mimir,loki'),
        },
        true
      );
    });

    it('should update nav_scope_path in URL when navScopePath changes', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: ['mimir', 'loki', 'tempo'],
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: ['mimir', 'loki'],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: 'navScope1',
          nav_scope_path: encodeURIComponent('mimir,loki,tempo'),
        },
        true
      );
    });

    it('should clear nav_scope_path from URL when navScopePath becomes empty', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: [],
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: ['mimir'],
        }
      );

      expect(locationService.partial).toHaveBeenCalledWith(
        {
          navigation_scope: 'navScope1',
          nav_scope_path: null,
        },
        true
      );
    });

    it('should not update URL when only drawerOpened changes but navigationScope and navScopePath remain the same', () => {
      if (!dashboardsStateSubscription) {
        throw new Error('dashboardsStateSubscription not set');
      }

      jest.clearAllMocks();

      dashboardsStateSubscription(
        {
          navigationScope: 'navScope1',
          drawerOpened: false,
          navScopePath: ['mimir'],
        },
        {
          navigationScope: 'navScope1',
          drawerOpened: true,
          navScopePath: ['mimir'],
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

  describe('back/forward navigation handling', () => {
    let locationSubject: BehaviorSubject<{ pathname: string; search: string }>;

    beforeEach(() => {
      locationSubject = new BehaviorSubject({
        pathname: '/test',
        search: '',
      });

      locationService.getLocation = jest.fn().mockReturnValue({
        pathname: '/test',
        search: '',
      });
      locationService.getLocationObservable = jest.fn().mockReturnValue(locationSubject);

      // Set initial state for dashboards service
      dashboardsService.state.navigationScope = undefined;
      dashboardsService.state.navScopePath = undefined;

      service = new ScopesService(selectorService, dashboardsService, locationService);
      service.setEnabled(true);

      jest.clearAllMocks();
    });

    it('should update navigation scope when URL changes via back/forward', () => {
      // Simulate URL change (e.g., browser back button)
      locationSubject.next({
        pathname: '/test',
        search: '?navigation_scope=navScope1',
      });

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope1', undefined, undefined);
    });

    it('should update nav_scope_path when URL changes via back/forward', () => {
      // Set current state
      dashboardsService.state.navigationScope = 'navScope1';
      dashboardsService.state.navScopePath = undefined;

      // Simulate URL change with nav_scope_path
      locationSubject.next({
        pathname: '/test',
        search: '?navigation_scope=navScope1&nav_scope_path=' + encodeURIComponent('mimir,loki'),
      });

      expect(dashboardsService.setNavScopePath).toHaveBeenCalledWith(['mimir', 'loki']);
    });

    it('should clear navigation scope when removed from URL via back/forward', () => {
      // Set current state
      dashboardsService.state.navigationScope = 'navScope1';
      dashboardsService.state.navScopePath = ['mimir'];

      // Simulate URL change (navigation scope removed)
      locationSubject.next({
        pathname: '/test',
        search: '',
      });

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith(undefined);
    });

    it('should handle navigation scope change along with nav_scope_path', () => {
      // Set current state
      dashboardsService.state.navigationScope = 'navScope1';
      dashboardsService.state.navScopePath = ['mimir'];

      // Simulate URL change to different navigation scope with new path
      locationSubject.next({
        pathname: '/test',
        search: '?navigation_scope=navScope2&nav_scope_path=' + encodeURIComponent('loki,tempo'),
      });

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('navScope2', undefined, ['loki', 'tempo']);
    });

    it('should handle URL-encoded navigation_scope from back/forward', () => {
      // Set current state
      dashboardsService.state.navigationScope = undefined;

      // Simulate URL change with encoded navigation scope
      locationSubject.next({
        pathname: '/test',
        search: '?navigation_scope=' + encodeURIComponent('scope with spaces'),
      });

      expect(dashboardsService.setNavigationScope).toHaveBeenCalledWith('scope with spaces', undefined, undefined);
    });

    it('should handle nav_scope_path change without navigation_scope', async () => {
      // Set current state - no navigation scope but has nav scope path
      dashboardsService.state.navigationScope = undefined;
      dashboardsService.state.navScopePath = undefined;
      selectorService.state.appliedScopes = [{ scopeId: 'scope1' }];

      // Simulate URL change with only nav_scope_path
      locationSubject.next({
        pathname: '/test',
        search: '?scopes=scope1&nav_scope_path=mimir',
      });

      // Wait for changeScopes promise
      await Promise.resolve();

      expect(dashboardsService.setNavScopePath).toHaveBeenCalledWith(['mimir']);
    });
  });
});
