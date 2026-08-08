import { HttpResponse } from 'msw';
import { act, render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  customGetPluginMetasHandler,
  mockPluginMeta,
  setMockPluginMetas,
  setMockStarredDashboards,
  setTestFlags,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { MegaMenu } from './MegaMenu';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// The starred-items sync resolves starred UIDs through the searcher, which has no MSW path.
jest.mock('app/features/search/service/searcher');

setBackendSrv(backendSrv);
setupMockServer();

const appMeta = (id: string, name: string) =>
  mockPluginMeta(id, name, {
    includes: [{ type: 'page', name: 'Overview', path: `/a/${id}/overview`, addToNav: true }],
  });

// A minimal client-built static tree: a plain section plus the attachment shells
// the plugin merge targets.
const staticNavTree: NavModelItem[] = [
  { id: 'home', text: 'Home', url: '/', sortWeight: -4000 },
  { id: 'dashboards/browse', text: 'Dashboards', url: '/dashboards', sortWeight: -3700 },
  { id: 'connections', text: 'Connections', url: '/connections', children: [], sortWeight: -2100 },
];

const renderMegaMenu = () => render(<MegaMenu onClose={() => {}} />, { preloadedState: { navBarTree: staticNavTree } });

describe('MegaMenu with the client-built nav tree (grafana.multiTenantNavTree)', () => {
  let userPermissions: (typeof contextSrv.user)['permissions'];
  let userOrgRole: (typeof contextSrv.user)['orgRole'];

  beforeEach(() => {
    setMockStarredDashboards([]);
    setMockPluginMetas([]);
    // The pluginMeta service caches the metas fetch for the session; clear it
    // so each test's MSW handler is actually hit.
    invalidateCachedPromisesCache();
    userPermissions = contextSrv.user.permissions;
    userOrgRole = contextSrv.user.orgRole;
    // dashboards:read makes the freshly built static tree include Dashboards
    contextSrv.user.permissions = { 'plugins.app:access': true, 'dashboards:read': true };
    // Plugin include visibility falls back to a role check (Viewer by default)
    contextSrv.user.orgRole = 'Editor' as typeof contextSrv.user.orgRole;
    setTestFlags({ 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true });
  });

  afterEach(async () => {
    contextSrv.user.permissions = userPermissions;
    contextSrv.user.orgRole = userOrgRole;
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
  });

  it('stays on the server-provided tree when the plugins.useMTPlugins flag is off', async () => {
    setTestFlags({ 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': false });

    renderMegaMenu();

    // No skeleton and no plugin merge: the preloaded (server) tree renders as-is
    expect(await screen.findByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connections' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Navigation' })).not.toHaveAttribute('aria-busy');
  });

  it('holds the skeleton until plugin nav merges, then renders the complete tree', async () => {
    setMockPluginMetas([appMeta('some-app', 'Some App')]);

    renderMegaMenu();

    // While the metas fetch is pending the whole menu is a skeleton
    expect(screen.getByRole('list', { name: 'Navigation' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('link', { name: 'Dashboards' })).not.toBeInTheDocument();

    // Once merged: static items, the plugin section, and no skeleton
    expect(await screen.findByRole('link', { name: 'More apps' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Navigation' })).not.toHaveAttribute('aria-busy');
  });

  it('prunes the empty attachment shells once the merge lands', async () => {
    renderMegaMenu();

    expect(await screen.findByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connections' })).not.toBeInTheDocument();
  });

  it('renders the static tree with a warning when the plugin nav fetch fails', async () => {
    server.use(customGetPluginMetasHandler(() => HttpResponse.json(null, { status: 500 })));

    renderMegaMenu();

    expect(await screen.findByText("Some navigation items couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Navigation' })).not.toHaveAttribute('aria-busy');
  });
});
