import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAppRoutes } from './routes';

// getAppPluginRoutes reads the Redux store, which isn't set up in this unit test.
jest.mock('app/features/plugins/routes', () => ({
  getAppPluginRoutes: () => [],
}));

describe('admin route guards', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function getRouteRolesGuard(path: string) {
    const route = getAppRoutes().find((r) => r.path === path);
    if (!route?.roles) {
      throw new Error(`Route not found or has no roles guard: ${path}`);
    }
    return route.roles;
  }

  // Each permission-gated /admin route mirrors the backend `authorize(...)` check in pkg/api/api.go.
  const permissionGatedRoutes: Array<[string, AccessControlAction]> = [
    ['/admin/settings', AccessControlAction.SettingsRead],
    ['/admin/users', AccessControlAction.UsersRead],
    ['/admin/users/create', AccessControlAction.UsersCreate],
    ['/admin/users/edit/:id', AccessControlAction.UsersRead],
    ['/admin/orgs', AccessControlAction.OrgsRead],
    ['/admin/orgs/edit/:id', AccessControlAction.OrgsRead],
    ['/admin/stats', AccessControlAction.ActionServerStatsRead],
    ['/admin/authentication/ldap', AccessControlAction.LDAPStatusRead],
  ];

  it.each(permissionGatedRoutes)('rejects %s without the required permission', (path) => {
    contextSrv.user.permissions = {};

    expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
  });

  it.each(permissionGatedRoutes)('allows %s with the required permission', (path, action) => {
    contextSrv.user.permissions = { [action]: true };

    expect(getRouteRolesGuard(path)()).toEqual([]);
  });

  it('allows /admin/users with org users read permission only', () => {
    contextSrv.user.permissions = { [AccessControlAction.OrgUsersRead]: true };

    expect(getRouteRolesGuard('/admin/users')()).toEqual([]);
  });
});

// Notebooks reuse dashboard RBAC actions rather than defining their own, so both notebook routes
// are gated on dashboards:read — the same action the notebooks apiserver resource resolves to.
describe('notebooks route guards', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function getRouteRolesGuard(path: string) {
    const route = getAppRoutes().find((r) => r.path === path);
    if (!route?.roles) {
      throw new Error(`Route not found or has no roles guard: ${path}`);
    }
    return route.roles;
  }

  const notebookRoutes = ['/notebooks', '/notebooks/:uid/:slug?'];

  it.each(notebookRoutes)('rejects %s without dashboards:read', (path) => {
    contextSrv.user.permissions = {};

    expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
  });

  it.each(notebookRoutes)('allows %s with dashboards:read', (path) => {
    contextSrv.user.permissions = { [AccessControlAction.DashboardsRead]: true };

    expect(getRouteRolesGuard(path)()).toEqual([]);
  });

  // The blank route is the only notebook one that writes, so reading is not enough to reach it.
  it('rejects /notebooks/new without dashboards:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.DashboardsRead]: true };

    expect(getRouteRolesGuard('/notebooks/new')()).toEqual(['Reject']);
  });

  it('allows /notebooks/new with dashboards:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.DashboardsCreate]: true };

    expect(getRouteRolesGuard('/notebooks/new')()).toEqual([]);
  });

  /**
   * A notebook created by typing moves from /notebooks/new to /notebooks/<uid> while somebody is
   * mid-sentence. Two SafeDynamicImport calls would give the two routes two component identities, so
   * React would unmount one and mount the other, and every cell's editor was rebuilt underneath the
   * writer. One shared component makes that a parameter change instead.
   */
  it('renders both notebook page routes through one component, so moving between them is not a remount', () => {
    const routes = getAppRoutes();
    const blank = routes.find((r) => r.path === '/notebooks/new');
    const byUid = routes.find((r) => r.path === '/notebooks/:uid/:slug?');

    expect(blank?.component).toBeDefined();
    expect(blank?.component).toBe(byUid?.component);
  });
});

describe('variables route guards', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function getRouteRolesGuard(path: string) {
    const route = getAppRoutes().find((r) => r.path === path);
    if (!route?.roles) {
      throw new Error(`Route not found or has no roles guard: ${path}`);
    }
    return route.roles;
  }

  const permissionGatedRoutes: Array<[string, AccessControlAction]> = [
    ['/dashboards/variables', AccessControlAction.VariablesRead],
    ['/dashboards/variables/new', AccessControlAction.VariablesCreate],
  ];

  it.each(permissionGatedRoutes)('rejects %s without the required permission', (path) => {
    contextSrv.user.permissions = {};

    expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
  });

  it.each(permissionGatedRoutes)('allows %s with the required permission', (path, action) => {
    contextSrv.user.permissions = { [action]: true };

    expect(getRouteRolesGuard(path)()).toEqual([]);
  });

  // Route guards look at flattened user.permissions, not orgRole. Viewers always have
  // variables:read (fixed:variables:reader); folder Edit also grants variables:create/write.
  it('allows a Viewer (variables:read only) to open the list but not create or edit', () => {
    contextSrv.user.permissions = { [AccessControlAction.VariablesRead]: true };

    expect(getRouteRolesGuard('/dashboards/variables')()).toEqual([]);
    expect(getRouteRolesGuard('/dashboards/variables/new')()).toEqual(['Reject']);
    expect(getRouteRolesGuard('/dashboards/variables/edit/:name')()).toEqual(['Reject']);
  });

  it('allows a Viewer with folder Edit to open list, create, and edit', () => {
    contextSrv.user.permissions = {
      [AccessControlAction.VariablesRead]: true,
      [AccessControlAction.VariablesCreate]: true,
      [AccessControlAction.VariablesWrite]: true,
    };

    expect(getRouteRolesGuard('/dashboards/variables')()).toEqual([]);
    expect(getRouteRolesGuard('/dashboards/variables/new')()).toEqual([]);
    expect(getRouteRolesGuard('/dashboards/variables/edit/:name')()).toEqual([]);
  });

  it.each([AccessControlAction.VariablesWrite, AccessControlAction.VariablesCreate])(
    'allows /dashboards/variables/edit/:name with %s',
    (action) => {
      contextSrv.user.permissions = { [action]: true };

      expect(getRouteRolesGuard('/dashboards/variables/edit/:name')()).toEqual([]);
    }
  );
});
