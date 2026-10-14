import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAlertingRoutes } from './routes';
import {
  LegacyRecentlyDeletedRedirect,
  LegacyRuleListRedirect,
} from './unified/gma-rule-list/legacy-migration/legacyRedirects';

describe('alerting route guards', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function getRouteRolesGuard(path: string) {
    const route = getAlertingRoutes().find((r) => r.path === path);
    if (!route?.roles) {
      throw new Error(`Route not found or has no roles guard: ${path}`);
    }
    return route.roles;
  }

  const groupEditPath = '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit';
  const groupViewPath = '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view';

  describe('Alert Group edit route', () => {
    it('rejects users with only read permissions (Viewer)', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleExternalRead]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('allows users with Grafana-managed update permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleUpdate]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual([]);
    });

    it('allows users with external write permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleExternalRead]: true,
        [AccessControlAction.AlertingRuleExternalWrite]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual([]);
    });
  });

  describe('Alert Group view route', () => {
    it('allows users with only read permissions (Viewer)', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleExternalRead]: true,
      };

      const guard = getRouteRolesGuard(groupViewPath);
      expect(guard()).toEqual([]);
    });
  });

  describe('Import to Grafana Alerting route', () => {
    const importToGmaPath = '/alerting/import-to-gma';

    it('allows users holding both convert permissions', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleCreate]: true,
        [AccessControlAction.AlertingProvisioningSetStatus]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual([]);
    });

    it('rejects users with only rule-create permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleCreate]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('rejects users with only provisioning-set-status permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingProvisioningSetStatus]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('rejects users with neither permission', () => {
      contextSrv.user.permissions = {};

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });
  });
});

describe('data source managed route proxies', () => {
  const unifiedAlertingEnabled = config.unifiedAlertingEnabled;

  afterEach(() => {
    config.unifiedAlertingEnabled = unifiedAlertingEnabled;
    setTestFlags();
  });

  it('gives every route that opted in an entry in the proxy table, and vice versa', async () => {
    // A route calling proxied() without a table entry hands nothing over; an entry for a route
    // that never opts in never runs. Both fail silently, which is why this is checked here.
    //
    // A wrapped route is recognisable by the component proxied() swapped in, which saves keeping a
    // list of the opted-in paths around in the app just so this test can read it.
    config.unifiedAlertingEnabled = true;
    setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: true });
    const wrapped = getAlertingRoutes()
      .filter(({ component }) => component?.name === 'ProxiedAlertingRoute')
      .map(({ path }) => path);
    const { routeProxies } = await import('./unified/plugin-proxy/proxies');

    expect(wrapped.sort()).toEqual(routeProxies.map(({ path }) => path).sort());
  });

  it('points every table entry at a route that actually exists', async () => {
    const routePaths = getAlertingRoutes().map((route) => route.path);
    const { routeProxies } = await import('./unified/plugin-proxy/proxies');

    for (const { path } of routeProxies) {
      expect(routePaths).toContain(path);
    }
  });

  it('gives every table entry both a check and a handler', async () => {
    const { routeProxies } = await import('./unified/plugin-proxy/proxies');

    expect(routeProxies).not.toHaveLength(0);
    for (const { matches, handler } of routeProxies) {
      expect(typeof matches).toBe('function');
      expect(typeof handler).toBe('function');
    }
  });
});

// NAV-1, NAV-2: GMA-only rule list routes and redirects, gated by alerting.gmaOnlyListView.
describe('GMA-only rule list routes', () => {
  const gmaRoutePaths = [
    '/alerting/rules/alert',
    '/alerting/rules/alert/deleted',
    '/alerting/rules/recording',
    '/alerting/rules/recording/deleted',
  ];

  afterEach(() => {
    setTestFlags();
  });

  it('does not register the new routes and keeps the legacy pages while the flag is off', () => {
    setTestFlags({ [FlagKeys.AlertingGmaOnlyListView]: false });

    const routes = getAlertingRoutes();
    const paths = routes.map((route) => route.path);

    for (const path of gmaRoutePaths) {
      expect(paths).not.toContain(path);
    }

    const listRoute = routes.find((route) => route.path === '/alerting/list');
    expect(listRoute?.component).not.toBe(LegacyRuleListRedirect);

    const deletedRoute = routes.find((route) => route.path === '/alerting/recently-deleted/');
    expect(deletedRoute?.component).not.toBe(LegacyRecentlyDeletedRedirect);
  });

  it('registers the new routes and redirects the legacy pages once the flag is on', () => {
    setTestFlags({ [FlagKeys.AlertingGmaOnlyListView]: true });

    const routes = getAlertingRoutes();
    const paths = routes.map((route) => route.path);

    for (const path of gmaRoutePaths) {
      expect(paths).toContain(path);
    }

    const listRoute = routes.find((route) => route.path === '/alerting/list');
    expect(listRoute?.component).toBe(LegacyRuleListRedirect);

    const deletedRoute = routes.find((route) => route.path === '/alerting/recently-deleted/');
    expect(deletedRoute?.component).toBe(LegacyRecentlyDeletedRedirect);
  });

  describe('access boundary once the flag is on', () => {
    const previousPermissions = contextSrv.user.permissions;

    beforeEach(() => {
      setTestFlags({ [FlagKeys.AlertingGmaOnlyListView]: true });
    });

    afterEach(() => {
      contextSrv.user.permissions = previousPermissions;
    });

    function getRouteRolesGuard(path: string) {
      const route = getAlertingRoutes().find((r) => r.path === path);
      if (!route?.roles) {
        throw new Error(`Route not found or has no roles guard: ${path}`);
      }
      return route.roles;
    }

    it.each(['/alerting/rules/alert', '/alerting/rules/recording'])(
      'denies a Viewer without alert.rules:read on %s',
      (path) => {
        contextSrv.user.permissions = {
          [AccessControlAction.AlertingRuleExternalRead]: true,
        };

        expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
      }
    );

    it.each(['/alerting/rules/alert', '/alerting/rules/recording'])(
      'allows a reader with Grafana-managed read on %s',
      (path) => {
        contextSrv.user.permissions = {
          [AccessControlAction.AlertingRuleRead]: true,
        };

        expect(getRouteRolesGuard(path)()).toEqual([]);
      }
    );

    it.each(['/alerting/rules/alert/deleted', '/alerting/rules/recording/deleted'])(
      'requires the organization Admin role for %s',
      (path) => {
        expect(getRouteRolesGuard(path)()).toEqual(['Admin']);
      }
    );
  });
});
