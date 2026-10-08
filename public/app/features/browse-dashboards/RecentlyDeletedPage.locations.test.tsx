import { http, HttpResponse } from 'msw';
import { act, type ComponentProps } from 'react';
import type AutoSizer from 'react-virtualized-auto-sizer';
import { cleanup, render, screen, waitFor, within } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { deletedDashboardsCache } from 'app/features/search/service/deletedDashboardsCache';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import RecentlyDeletedPage from './RecentlyDeletedPage';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default(props: ComponentProps<typeof AutoSizer>) {
    return props.children({ width: 1200, height: 600, scaledWidth: 1200, scaledHeight: 600 });
  },
}));

const dashboards = [
  { uid: 'parent-dashboard', title: 'Parent dashboard', folder: 'deleted-parent' },
  { uid: 'child-dashboard', title: 'Child dashboard', folder: 'deleted-child' },
  { uid: 'live-folder-dashboard', title: 'Live folder dashboard', folder: 'live-folder' },
  { uid: 'root-dashboard', title: 'Root dashboard', folder: '' },
];

function renderPage() {
  return render(<RecentlyDeletedPage />, {
    historyOptions: { initialEntries: ['/dashboard/recently-deleted'] },
    preloadedState: {
      navIndex: {
        'dashboards/recently-deleted': { id: 'dashboards/recently-deleted', text: 'Recently deleted' },
      },
    },
  });
}

describe('Recently deleted folder locations', () => {
  beforeEach(() => {
    localStorage.clear();
    deletedDashboardsCache.clear();
    getGrafanaSearcher().invalidateLocationInfo();
    dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });
    server.use(
      http.post('/apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards/trash', () =>
        HttpResponse.json({
          metadata: { totalHits: 4, totalHitsRelation: 'eq' },
          items: dashboards.map(({ uid, title, folder }) => ({
            resource: { group: 'dashboard.grafana.app', resource: 'dashboards', name: uid },
            fields: { title, folder },
          })),
        })
      ),
      http.get('/apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards', () =>
        HttpResponse.json({
          metadata: {},
          columnDefinitions: [{ name: 'Title', type: 'string' }],
          rows: dashboards.map(({ uid, title, folder }) => ({
            cells: [title],
            object: { metadata: { name: uid, annotations: { 'grafana.app/folder': folder } } },
          })),
        })
      )
    );
  });

  afterEach(() => {
    cleanup();
    setTestFlags({});
    dashboardAPIVersionResolver.reset();
  });

  it.each([
    { source: 'trash endpoint', viaTrash: true },
    { source: 'legacy listing', viaTrash: false },
  ])('removes cached links to deleted folders on entry using the $source', async ({ viaTrash }) => {
    setTestFlags({ [FlagKeys.DashboardRecentlyDeletedViaTrash]: viaTrash });
    let folders = [
      { name: 'deleted-parent', title: 'Deleted parent', resource: 'folders' },
      { name: 'deleted-child', title: 'Deleted child', resource: 'folders', folder: 'deleted-parent' },
      { name: 'live-folder', title: 'Live folder', resource: 'folders' },
    ];
    server.use(http.get(searchRoute, () => HttpResponse.json({ totalHits: folders.length, hits: folders })));

    const cachedLocations = await getGrafanaSearcher().getLocationInfo();
    expect(cachedLocations['deleted-parent'].url).toBe('/dashboards/f/deleted-parent');
    expect(cachedLocations['deleted-child'].url).toBe('/dashboards/f/deleted-child');

    folders = [{ name: 'live-folder', title: 'Live folder', resource: 'folders' }];
    renderPage();

    const parentRow = within(await screen.findByRole('row', { name: /Parent dashboard/ }));
    expect(parentRow.getByText('deleted-parent')).toBeInTheDocument();
    expect(parentRow.queryByRole('link')).not.toBeInTheDocument();

    const childRow = within(screen.getByRole('row', { name: /Child dashboard/ }));
    expect(childRow.getByText('deleted-child')).toBeInTheDocument();
    expect(childRow.queryByRole('link')).not.toBeInTheDocument();

    const liveRow = within(screen.getByRole('row', { name: /Live folder dashboard/ }));
    expect(liveRow.getByRole('link', { name: 'Live folder' })).toHaveAttribute('href', '/dashboards/f/live-folder');

    const rootRow = within(screen.getByRole('row', { name: /Root dashboard/ }));
    expect(rootRow.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/dashboards');
  });

  it('reuses folder locations when filtering and sorting, and refreshes them on the next visit', async () => {
    setTestFlags({ [FlagKeys.DashboardRecentlyDeletedViaTrash]: false });
    let folderTitle = 'Live folder';
    const folderRequest = jest.fn();
    server.use(
      http.get(searchRoute, () => {
        folderRequest();
        return HttpResponse.json({
          totalHits: 1,
          hits: [{ name: 'live-folder', title: folderTitle, resource: 'folders' }],
        });
      })
    );

    const { user, unmount } = renderPage();
    expect(await screen.findByRole('link', { name: 'Live folder' })).toHaveAttribute(
      'href',
      '/dashboards/f/live-folder'
    );
    folderTitle = 'Renamed folder';

    await user.type(screen.getByPlaceholderText('Search for dashboards'), 'Live folder dashboard');
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });
    expect(screen.getByRole('link', { name: 'Live folder' })).toHaveAttribute('href', '/dashboards/f/live-folder');

    await user.clear(screen.getByPlaceholderText('Search for dashboards'));
    await screen.findByRole('row', { name: /Parent dashboard/ });
    await user.click(screen.getByRole('combobox', { name: 'Sort' }));
    await user.click(screen.getByText('Alphabetically (Z–A)'));
    await waitFor(() => {
      expect(screen.getAllByRole('row')[1]).toHaveTextContent('Root dashboard');
    });
    expect(folderRequest).toHaveBeenCalledTimes(1);

    unmount();
    renderPage();

    expect(await screen.findByRole('link', { name: 'Renamed folder' })).toHaveAttribute(
      'href',
      '/dashboards/f/live-folder'
    );
    expect(folderRequest).toHaveBeenCalledTimes(2);
  });

  it('hides previous folder links while the next visit waits for fresh locations', async () => {
    setTestFlags({ [FlagKeys.DashboardRecentlyDeletedViaTrash]: true });
    server.use(
      http.get(searchRoute, () =>
        HttpResponse.json({
          totalHits: 1,
          hits: [{ name: 'deleted-parent', title: 'Deleted parent', resource: 'folders' }],
        })
      )
    );
    const { unmount } = renderPage();
    expect(await screen.findByRole('link', { name: 'Deleted parent' })).toHaveAttribute(
      'href',
      '/dashboards/f/deleted-parent'
    );
    unmount();

    let releaseLocations!: () => void;
    const locationsReady = new Promise<void>((resolve) => (releaseLocations = resolve));
    const folderRequest = jest.fn();
    server.use(
      http.get(searchRoute, async () => {
        folderRequest();
        await locationsReady;
        return HttpResponse.json({ totalHits: 0, hits: [] });
      })
    );

    renderPage();
    try {
      await waitFor(() => expect(folderRequest).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Recently deleted' })).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /Parent dashboard/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Deleted parent' })).not.toBeInTheDocument();
    } finally {
      await act(async () => releaseLocations());
    }

    const parentRow = within(await screen.findByRole('row', { name: /Parent dashboard/ }));
    expect(parentRow.getByText('deleted-parent')).toBeInTheDocument();
    expect(parentRow.queryByRole('link')).not.toBeInTheDocument();
  });
});
