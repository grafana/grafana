import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { config, getStarsSrv, setBackendSrv, setStarsSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler, getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  getFolderFixtures,
  MOCK_STARRED_KIND_PAGE,
  MOCK_STARRED_KIND_SERVED,
  setMockStarredDashboards,
  setMockStarredFolders,
  setMockStarredPluginKind,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type GrafanaSearcher, type SearchQuery } from 'app/features/search/service/types';
import { useStarredSearch } from 'app/features/stars/hooks';
import { CollectionsStarsSrv } from 'app/features/stars/service';

import { useNavTree } from './useNavTree';

jest.mock('app/features/search/service/searcher');

const mockedGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);

const [_, { dashbdD, folderA_dashbdD, folderA }] = getFolderFixtures();
// The starred fixtures are: dashbdD.item.uid, folderA_dashbdD.item.uid
const starredDashboards = [dashbdD.item, folderA_dashbdD.item];
// A plugin kind's name is whatever its API uses; this one is a UUID
const THING_UUID = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';
const THING_URL = `/a/test-things-app/things/${THING_UUID}`;
const { group: THING_GROUP, kind: THING_KIND } = MOCK_STARRED_KIND_SERVED;
const THING_ROW = `synced-starred/${THING_GROUP}/${THING_KIND}/${THING_UUID}`;

setBackendSrv(backendSrv);
// Stars go through the runtime service, which refuses signed-out callers
setStarsSrv(new CollectionsStarsSrv());
contextSrv.isSignedIn = true;
setupMockServer();

/** Serves the Thing kind through discovery, so its plugin page is found and it resolves through its own search. */
function installThingsApp() {
  server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
}

/** Renders the tree plus the starred search status, with a read-only list of the tree's starred children */
const TestHarness = () => {
  const navTree = useNavTree();
  const { loading: starredLoading, error: starredError } = useStarredSearch();
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <span data-testid="loading-state">{String(starredLoading)}</span>
      <span data-testid="error-state">{String(starredError)}</span>
      <ul data-testid="starred-list">
        {starred?.children?.map((child) => (
          <li key={child.id} data-testid={`synced-${child.id}`} data-icon={child.icon} data-url={child.url}>
            {child.text}
          </li>
        ))}
      </ul>
    </>
  );
};

/** Renders a folder star button plus a read-only list of nav starred children */
const StarFolderHarness = ({ uid }: { uid: string }) => {
  const [starDone, setStarDone] = useState(false);
  const navTree = useNavTree();
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <button
        onClick={async () => {
          try {
            await getStarsSrv().star({ group: 'folder.grafana.app', kind: 'Folder', id: uid });
          } catch {
            // The collections client reports the failure
          }
          setStarDone(true);
        }}
      >
        star folder
      </button>
      <span data-testid="star-done">{String(starDone)}</span>
      <ul data-testid="starred-list">
        {starred?.children?.map((child) => (
          <li key={child.id} data-testid={`synced-${child.id}`} data-icon={child.icon} data-url={child.url}>
            {child.text}
          </li>
        ))}
      </ul>
    </>
  );
};

type SearchRow = { uid: string; name: string; url: string; kind: string };

/** Mocks the searcher over `items`, answering each request with the rows of the kinds and names it asked for. */
function setupSearchMock(items: SearchRow[]) {
  const mockSearcher = {
    search: jest.fn(({ name = [], kind = [] }: SearchQuery) => {
      const rows = items.filter((item) => kind.includes(item.kind) && name.includes(item.uid));
      return Promise.resolve({
        view: {
          length: rows.length,
          get: (i: number) => rows[i],
          toArray: () => rows,
          dataFrame: { fields: [], length: rows.length },
        },
        totalRows: rows.length,
        isItemLoaded: () => true,
        loadMoreItems: () => Promise.resolve(),
      });
    }),
    starred: jest.fn(),
    tags: jest.fn(),
    getSortOptions: jest.fn(),
    getLocationInfo: jest.fn(),
    reloadLocationInfo: jest.fn(),
    getFolderViewSort: jest.fn().mockReturnValue('name_sort'),
  };
  mockedGetGrafanaSearcher.mockReturnValue(mockSearcher as unknown as GrafanaSearcher);
  return mockSearcher;
}

describe('useNavTree', () => {
  beforeEach(() => {
    // The backend ships the Starred section empty; the hook fills its children. The mock plugin's page is what
    // makes its kind one Grafana can show.
    config.bootData.navTree = [
      { id: 'home', text: 'Home', url: '/' },
      { id: 'starred', text: 'Starred', children: [] },
      MOCK_STARRED_KIND_PAGE,
    ];
    // Star sets are module-level in the mock server, so start each case from the fixture set
    setMockStarredDashboards(starredDashboards.map((d) => d.uid));
    setMockStarredFolders([]);
  });

  it('populates the starred nav section with metadata from search', async () => {
    const mockSearcher = setupSearchMock(
      starredDashboards.map((d) => ({
        uid: d.uid,
        name: d.title,
        url: `/d/${d.uid}`,
        kind: 'dashboard',
      }))
    );

    render(<TestHarness />);

    // Loading until the stars query and search round-trip complete
    expect(screen.getByTestId('loading-state')).toHaveTextContent('true');

    await waitFor(() => {
      expect(mockSearcher.search).toHaveBeenCalledWith({
        name: starredDashboards.map((d) => d.uid).sort(),
        kind: ['dashboard'],
        limit: starredDashboards.length,
      });
    });

    // Verify items appeared in the nav tree (sorted alphabetically), each carrying the
    // dashboard kind icon that distinguishes them from starred folders.
    for (const dash of starredDashboards) {
      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/dashboard/${dash.uid}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId(`synced-starred/dashboard/${dash.uid}`)).toHaveAttribute('data-icon', 'apps');
    }

    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
  });

  it('keeps the starred section empty when no stars exist', async () => {
    server.use(
      http.get('/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars', () =>
        HttpResponse.json({
          kind: 'StarsList',
          apiVersion: 'collections.grafana.app/v1alpha1',
          metadata: { resourceVersion: '1' },
          items: [],
        })
      )
    );

    const mockSearcher = setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      const list = screen.getByTestId('starred-list');
      expect(list.children).toHaveLength(0);
    });

    // Search should NOT be called when there are no stars
    expect(mockSearcher.search).not.toHaveBeenCalled();

    // Loading resolves even without a search round-trip
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });
  });

  it('reports an error and leaves the nav untouched when search fails', async () => {
    const mockSearcher = setupSearchMock([]);
    mockSearcher.search.mockRejectedValue(new Error('search unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toHaveTextContent('true');
    });

    // Loading resolved instead of spinning forever, and no items were dispatched
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    expect(screen.getByTestId('starred-list').children).toHaveLength(0);
  });

  it('searches a star set larger than one request in several requests and shows every row', async () => {
    // 51 starred dashboards, uids d00..d50
    const uids = Array.from({ length: 51 }, (_, i) => `d${String(i).padStart(2, '0')}`);
    setMockStarredDashboards(uids);
    const mockSearcher = setupSearchMock(uids.map((uid) => ({ uid, name: uid, url: `/d/${uid}`, kind: 'dashboard' })));

    render(<TestHarness />);

    await waitFor(() => {
      expect(mockSearcher.search).toHaveBeenCalledTimes(2);
    });
    expect(mockSearcher.search).toHaveBeenCalledWith({ name: uids.slice(0, 50), kind: ['dashboard'], limit: 50 });
    expect(mockSearcher.search).toHaveBeenCalledWith({ name: ['d50'], kind: ['dashboard'], limit: 1 });
    await waitFor(() => {
      expect(screen.getByTestId('starred-list').children).toHaveLength(51);
    });
    expect(screen.getByTestId('synced-starred/dashboard/d50')).toBeInTheDocument();
  });

  it('loads the app kinds only once the stars hold one, then lists it', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    const discovery = jest.fn(() => HttpResponse.json({ items: [] }));
    server.use(http.get('/apis', discovery));
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    const { unmount } = render(<TestHarness />);

    // Dashboards alone need no discovery
    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });
    expect(discovery).not.toHaveBeenCalled();
    unmount();

    setMockStarredPluginKind(THING_GROUP, THING_KIND, [THING_UUID]);
    installThingsApp();
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'My Thing' }]));

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(THING_ROW)).toHaveTextContent('My Thing');
    });
    expect(screen.getByTestId(THING_ROW)).toHaveAttribute('data-url', THING_URL);
    expect(screen.getByTestId(THING_ROW)).toHaveAttribute('data-icon', 'cube');
  });

  it('re-searches a starred plugin object its plugin reports saved, and shows the saved title', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(THING_GROUP, THING_KIND, [THING_UUID]);
    installThingsApp();
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'Old title' }]));
    setupSearchMock([]);

    render(<TestHarness />);
    await waitFor(() => {
      expect(screen.getByTestId(THING_ROW)).toHaveTextContent('Old title');
    });

    // The plugin saved the object under a new title, then tells Grafana
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'New title' }]));
    getStarsSrv().resourceUpdated({ group: THING_GROUP, kind: THING_KIND, id: THING_UUID });

    await waitFor(() => {
      expect(screen.getByTestId(THING_ROW)).toHaveTextContent('New title');
    });
  });

  it('keeps dashboards in the nav and reports no error when a plugin kind API is unavailable', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    setMockStarredPluginKind(THING_GROUP, THING_KIND, [THING_UUID]);
    installThingsApp();
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 503 })));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');

    // A plugin kind's API is served by the plugin and may be absent: not an error, the object is simply not shown
    expect(screen.getByTestId('error-state')).toHaveTextContent('false');
    expect(screen.queryByTestId(THING_ROW)).not.toBeInTheDocument();
  });

  it('drops stars of a kind no plugin lists', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    setMockStarredPluginKind('gone.ext.grafana.app', 'Ghost', ['g1']);
    server.use(getKindDiscoveryHandler());
    const mockSearcher = setupSearchMock([
      { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
    ]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });

    // Nothing knows how to show a Ghost, so it is neither searched for nor listed
    expect(mockSearcher.search).toHaveBeenCalledWith({ name: [dashUid], kind: ['dashboard'], limit: 1 });
    expect(screen.getByTestId('starred-list').children).toHaveLength(1);
  });

  describe('with starred folders in the star set', () => {
    it('syncs both a starred dashboard and folder, each with its per-kind icon', async () => {
      const dashUid = dashbdD.item.uid;
      const folderUid = folderA.item.uid;
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);

      const mockSearcher = setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      // One search across both kinds, keyed by the sorted union of starred uids, with room for a same-uid resource
      // of the other kind
      await waitFor(() => {
        expect(mockSearcher.search).toHaveBeenCalledWith({
          name: [dashUid, folderUid].sort(),
          kind: ['dashboard', 'folder'],
          limit: 4,
        });
      });

      // Both kinds land in the nav Starred section
      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId(`synced-starred/folder/${folderUid}`)).toBeInTheDocument();

      // ...and carry the icon that distinguishes them
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toHaveAttribute('data-icon', 'apps');
      expect(screen.getByTestId(`synced-starred/folder/${folderUid}`)).toHaveAttribute('data-icon', 'folder');
    });

    it('orders a synced dashboard before a synced folder even when the folder title sorts first', async () => {
      const dashUid = dashbdD.item.uid;
      const folderUid = folderA.item.uid;
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);

      // Folder title alphabetically precedes the dashboard title, so a pure
      // alphabetical sort would render the folder first — kind grouping must win.
      setupSearchMock([
        { uid: dashUid, name: 'ZZZ Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'AAA Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/folder/${folderUid}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();

      // DOM order mirrors nav children order: the dashboard row renders before the folder row
      const rowIds = Array.from(screen.getByTestId('starred-list').children).map((el) =>
        el.getAttribute('data-testid')
      );
      expect(rowIds).toEqual([`synced-starred/dashboard/${dashUid}`, `synced-starred/folder/${folderUid}`]);
    });

    it('drops a search row whose uid was starred as a different kind', async () => {
      const dashUid = dashbdD.item.uid;
      const folderUid = folderA.item.uid;
      // dashUid is starred as a dashboard ONLY; the folder star set holds a different uid,
      // so the per-kind filter must be keyed by kind rather than by mere star existence.
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);

      // The single search matches the uid union against BOTH kinds, so it returns an UNSTARRED folder that shares
      // the starred dashboard's uid. Without the per-kind post-filter the bogus folder row would render beside the
      // dashboard.
      setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
        { uid: dashUid, name: 'Bogus Folder', url: `/dashboards/f/${dashUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/folder/${folderUid}`)).toBeInTheDocument();
      });

      // The colliding uid shows as the dashboard only, not as the unstarred folder
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toHaveTextContent('My Dashboard');
      expect(screen.queryByTestId(`synced-starred/folder/${dashUid}`)).not.toBeInTheDocument();
      expect(screen.queryByText('Bogus Folder')).not.toBeInTheDocument();

      // ...while the genuinely starred folder is there
      expect(screen.getByTestId(`synced-starred/folder/${folderUid}`)).toHaveAttribute('data-icon', 'folder');
      expect(screen.getByTestId('starred-list').children).toHaveLength(2);
    });

    it('shows a uid starred as both kinds as one row per kind, each under its own id', async () => {
      const uid = dashbdD.item.uid;
      // The SAME uid sits in both per-kind star sets, and both resources exist
      setMockStarredDashboards([uid]);
      setMockStarredFolders([uid]);

      const mockSearcher = setupSearchMock([
        { uid, name: 'My Dashboard', url: `/d/${uid}`, kind: 'dashboard' },
        { uid, name: 'My Folder', url: `/dashboards/f/${uid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      // The union of the per-kind star sets is deduped: the uid lands in `name` exactly once
      await waitFor(() => {
        expect(mockSearcher.search).toHaveBeenCalledWith({ name: [uid], kind: ['dashboard', 'folder'], limit: 2 });
      });

      // ...and each starred resource is its own row: the ids differ by kind, so neither key nor action id collides
      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/folder/${uid}`)).toHaveTextContent('My Folder');
      });
      expect(screen.getByTestId(`synced-starred/dashboard/${uid}`)).toHaveTextContent('My Dashboard');
      expect(screen.getByTestId('starred-list').children).toHaveLength(2);
    });

    it('lists a starred plugin object after the dashboard and folder rows, resolved through its kind search', async () => {
      const dashUid = dashbdD.item.uid;
      const folderUid = folderA.item.uid;
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);
      setMockStarredPluginKind(THING_GROUP, THING_KIND, [THING_UUID]);
      installThingsApp();
      // The title sorts before both other titles, so a pure alphabetical sort would render it first
      server.use(
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'AAA Thing', folder: folderUid }])
      );
      const mockSearcher = setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(THING_ROW)).toBeInTheDocument();
      });

      // The dashboard search is asked about dashboard and folder uids only; the plugin kind resolves through its API
      expect(mockSearcher.search).toHaveBeenCalledWith({
        name: [dashUid, folderUid].sort(),
        kind: ['dashboard', 'folder'],
        limit: 4,
      });
      expect(screen.getByTestId(THING_ROW)).toHaveTextContent('AAA Thing');

      // Kind grouping wins over the alphabet: dashboard, then folder, then the plugin kind
      const rowIds = Array.from(screen.getByTestId('starred-list').children).map((el) =>
        el.getAttribute('data-testid')
      );
      expect(rowIds).toEqual([`synced-starred/dashboard/${dashUid}`, `synced-starred/folder/${folderUid}`, THING_ROW]);
    });
  });
});

describe('useNavTree after a star toggle', () => {
  beforeEach(() => {
    // The backend ships the Starred section empty; the hook fills its children
    config.bootData.navTree = [
      { id: 'home', text: 'Home', url: '/' },
      { id: 'starred', text: 'Starred', children: [] },
    ];
    // Star sets are module-level in the mock server, so start each case with no stars
    setMockStarredDashboards([]);
    setMockStarredFolders([]);
  });

  it('adds a starred folder to the nav starred section with the folder url and icon', async () => {
    const folderUid = folderA.item.uid;
    setupSearchMock([
      { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}/my-folder`, kind: 'folder' },
    ]);

    const { user } = render(<StarFolderHarness uid={folderUid} />);

    await user.click(screen.getByRole('button', { name: 'star folder' }));

    const entry = await screen.findByTestId(`synced-starred/folder/${folderUid}`);
    expect(entry).toHaveTextContent('My Folder');
    expect(entry).toHaveAttribute('data-url', `/dashboards/f/${folderUid}/my-folder`);
    expect(entry).toHaveAttribute('data-icon', 'folder');
  });

  // A successful folder star lands in the nav, so a rejected one must not.
  it('leaves the nav starred section untouched when the server rejects the star', async () => {
    const folderUid = folderA.item.uid;
    setupSearchMock([]);

    server.use(
      http.put(
        '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id',
        () => new HttpResponse(null, { status: 500 })
      )
    );

    const { user } = render(<StarFolderHarness uid={folderUid} />);

    await user.click(screen.getByRole('button', { name: 'star folder' }));

    // The star round-trip finished without an unhandled rejection escaping the click handler...
    await waitFor(() => {
      expect(screen.getByTestId('star-done')).toHaveTextContent('true');
    });

    // ...and the rejected star never mutated the nav tree
    expect(screen.queryByTestId(`synced-starred/folder/${folderUid}`)).not.toBeInTheDocument();
    expect(screen.getByTestId('starred-list').children).toHaveLength(0);
  });
});
