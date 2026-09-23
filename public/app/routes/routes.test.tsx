import { type ComponentType, Suspense } from 'react';
import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAppRoutes } from './routes';

// getAppPluginRoutes reads the Redux store, which isn't set up in this unit test.
jest.mock('app/features/plugins/routes', () => ({
  getAppPluginRoutes: () => [],
}));

// Stands in for the real page, which would want a notebook, a state manager and a route match. The
// point of the test below is that the route's lazy import resolves to this module at all.
jest.mock('../features/notebook/pages/NotebookRenderPage', () => ({
  __esModule: true,
  default: () => <div data-testid="notebook-render-page" />,
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

  const notebookRoutes = ['/notebooks', '/notebooks/:uid/:slug?', '/notebooks/:uid/render'];

  it.each(notebookRoutes)('rejects %s without notebooks:read', (path) => {
    contextSrv.user.permissions = {};

    expect(getRouteRolesGuard(path)()).toEqual(['Reject']);
  });

  it.each(notebookRoutes)('allows %s with notebooks:read', (path) => {
    contextSrv.user.permissions = { [AccessControlAction.NotebooksRead]: true };

    expect(getRouteRolesGuard(path)()).toEqual([]);
  });

  // The blank route is the only notebook one that writes, so reading is not enough to reach it.
  it('rejects /notebooks/new without notebooks:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.NotebooksRead]: true };

    expect(getRouteRolesGuard('/notebooks/new')()).toEqual(['Reject']);
  });

  // The route creates a notebook, which the apiserver authorizes with its own action — write alone
  // would admit a user whose save is then denied.
  it('allows /notebooks/new with notebooks:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.NotebooksCreate]: true };

    expect(getRouteRolesGuard('/notebooks/new')()).toEqual([]);
  });

  it('rejects /notebooks/new for a writer who cannot create', () => {
    contextSrv.user.permissions = { [AccessControlAction.NotebooksWrite]: true };

    expect(getRouteRolesGuard('/notebooks/new')()).toEqual(['Reject']);
  });

  /**
   * The route the PDF export points the headless renderer at. `chromeless` is the whole reason it
   * exists as its own route: it is what keeps Grafana's app shell off a page that is going to be a
   * document, so the page never has to reach out and undo the shell's styling.
   */
  it('renders the notebook render route without app chrome, on its own page', () => {
    const routes = getAppRoutes();
    const renderRoute = routes.find((r) => r.path === '/notebooks/:uid/render');
    const viewRoute = routes.find((r) => r.path === '/notebooks/:uid/:slug?');

    expect(renderRoute?.chromeless).toBe(true);
    // A different page, not the notebook page in a mode: it leaves out the toolbar and controls row
    // rather than hiding them.
    expect(renderRoute?.component).toBeDefined();
    expect(renderRoute?.component).not.toBe(viewRoute?.component);
    // The view route is emphatically NOT chromeless — a regression there would strip the app shell
    // from everybody reading a notebook.
    expect(viewRoute?.chromeless).toBeFalsy();
  });

  /**
   * Every route in this file loads its page through `SafeDynamicImport`, i.e. `React.lazy`, so the
   * import only runs when something actually renders the component. Rendering it here checks the
   * specifier resolves — a typo or a moved file is otherwise invisible until the route is opened.
   */
  it('resolves the render route to the notebook render page', async () => {
    const route = getAppRoutes().find((r) => r.path === '/notebooks/:uid/render');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the stub above reads no route props
    const RenderPage = route?.component as unknown as ComponentType;

    render(
      <Suspense fallback={null}>
        <RenderPage />
      </Suspense>
    );

    expect(await screen.findByTestId('notebook-render-page')).toBeInTheDocument();
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
