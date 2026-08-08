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

  // The /admin landing page mirrors the backend `reqOrgAdmin` middleware (an org-role check),
  // so it guards on roles rather than an RBAC action.
  it('restricts /admin landing page to org admins and server admins', () => {
    expect(getRouteRolesGuard('/admin')()).toEqual(['Admin', 'ServerAdmin']);
  });
});
