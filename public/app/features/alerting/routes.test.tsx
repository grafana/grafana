import { type ComponentType } from 'react';
import { render, waitFor } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAlertingRoutes } from './routes';
import { grantUserRole } from './unified/mocks';

describe('alerting route guards', () => {
  const previousPermissions = contextSrv.user.permissions;
  const previousOrgRole = contextSrv.user.orgRole;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
    contextSrv.user.orgRole = previousOrgRole;
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

  describe('Import data source managed rules route', () => {
    const path = '/alerting/import-datasource-managed-rules';
    const importPermissions = {
      [AccessControlAction.AlertingRuleCreate]: true,
      [AccessControlAction.AlertingProvisioningSetStatus]: true,
    };

    afterEach(() => {
      setTestFlags();
    });

    it.each([true, false])(
      'allows users with both import permissions, without the Admin role (wizard on: %s)',
      (on) => {
        setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: on });
        contextSrv.user.permissions = importPermissions;

        expect(getRouteRolesGuard(path)()).toEqual([]);
      }
    );

    it('sends admins on to the full wizard in Settings > Import', async () => {
      setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: true });
      grantUserRole(OrgRole.Admin);
      contextSrv.user.permissions = importPermissions;
      const Component = getAlertingRoutes().find((r) => r.path === path)!.component as ComponentType;

      render(<Component />);

      await waitFor(() => expect(locationService.getLocation().pathname).toBe('/alerting/admin/import'));
      expect(locationService.getLocation().search).toBe('?step=rules');
    });

    it.each([
      ['alert.rules:create', AccessControlAction.AlertingRuleCreate],
      ['alert.provisioning.status:write', AccessControlAction.AlertingProvisioningSetStatus],
    ])('rejects users who only have %s, with the wizard on or off', (_, onlyPermission) => {
      contextSrv.user.permissions = { [onlyPermission]: true };

      setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: true });
      expect(getRouteRolesGuard(path)()).toEqual(['Reject']);

      setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: false });
      expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
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

describe('GMA-only Alert rules route', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    setTestFlags();
    contextSrv.user.permissions = previousPermissions;
  });

  function getRoutes(flag: boolean) {
    setTestFlags({ [FlagKeys.AlertingGmaOnlyListView]: flag });
    return getAlertingRoutes();
  }

  it('registers /alerting/rules/alert and /alerting/rules/recording only with the flag on', () => {
    const routesOff = getRoutes(false);
    const routesOn = getRoutes(true);

    expect(routesOff.map((route) => route.path)).not.toContain('/alerting/rules/alert');
    expect(routesOff.map((route) => route.path)).not.toContain('/alerting/rules/recording');
    expect(routesOn.map((route) => route.path)).toEqual([
      ...routesOff.map((route) => route.path),
      '/alerting/rules/alert',
      '/alerting/rules/alert/deleted',
      '/alerting/rules/recording',
    ]);
  });

  it('denies a user with only data source-managed read and admits a Grafana-managed reader (alert route)', () => {
    const guard = getRoutes(true).find((route) => route.path === '/alerting/rules/alert')?.roles;

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleExternalRead]: true };
    expect(guard?.()).toEqual(['Reject']);

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    expect(guard?.()).toEqual([]);
  });

  it('denies a user with only data source-managed read and admits a Grafana-managed reader (recording route)', () => {
    const guard = getRoutes(true).find((route) => route.path === '/alerting/rules/recording')?.roles;

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleExternalRead]: true };
    expect(guard?.()).toEqual(['Reject']);

    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    expect(guard?.()).toEqual([]);
  });
});
