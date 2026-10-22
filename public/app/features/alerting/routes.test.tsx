import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAlertingRoutes } from './routes';

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
    // The wizard lives on the admin-only Settings > Import tab, and the old URL redirects there.
    it.each(['/alerting/import-to-gma', '/alerting/admin/import'])('is admin-only: %s', (path) => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleCreate]: true,
        [AccessControlAction.AlertingProvisioningSetStatus]: true,
      };

      const guard = getRouteRolesGuard(path);
      expect(guard()).toEqual(['Admin']);
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
