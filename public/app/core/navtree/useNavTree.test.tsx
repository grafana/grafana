import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { testWithStarsUser } from 'test/helpers/testWithStarsUser';
import { render, screen, waitFor } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
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
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type GrafanaSearcher, type SearchQuery } from 'app/features/search/service/types';
import { useStarItem, useStarredSearch } from 'app/features/stars/hooks';

import { useNavTree } from './useNavTree';

jest.mock('app/features/search/service/searcher');

const mockedGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);

const [_, { dashbdD, folderA_dashbdD, folderA }] = getFolderFixtures();
// The starred fixtures are: dashbdD.item.uid, folderA_dashbdD.item.uid
const starredDashboards = [dashbdD.item, folderA_dashbdD.item];
// A plugin kind's name is whatever its API uses; this one is a UUID
const THING_UUID = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';
const { group: THING_GROUP, kind: THING_KIND } = MOCK_STARRED_KIND_SERVED;
const THING_ROW = `synced-starred/${THING_GROUP}/${THING_KIND}/${THING_UUID}`;

setBackendSrv(backendSrv);
setupMockServer();

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

/** Renders the folder star callback plus a read-only list of nav starred children */
const StarFolderHarness = ({ uid }: { uid: string }) => {
  const starItem = useStarItem('folder.grafana.app', 'Folder');
  const [starDone, setStarDone] = useState(false);
  const navTree = useNavTree();
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <button
        onClick={async () => {
          await starItem(uid, true);
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

testWithStarsUser();

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

  it('does not ask what the instance serves while only dashboards and folders are starred', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    const discovery = jest.fn(() => HttpResponse.json({ items: [] }));
    server.use(http.get('/apis', discovery));
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });
    expect(discovery).not.toHaveBeenCalled();
  });

  describe('with a starred plugin object', () => {
    const dashUid = dashbdD.item.uid;
    const DASHBOARD_ROW = `synced-starred/dashboard/${dashUid}`;
    const starredRowIds = () =>
      Array.from(screen.getByTestId('starred-list').children).map((el) => el.getAttribute('data-testid'));

    beforeEach(() => {
      setMockStarredDashboards([dashUid]);
      setMockStarredPluginKind(THING_GROUP, THING_KIND, [THING_UUID]);
      setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('lists it after the dashboards and folders, each plugin kind in the order the instance serves it', async () => {
      const widgetsServed = { group: 'widgets.ext.grafana.app', version: 'v1', kind: 'Widget', plural: 'widgets' };
      const folderUid = folderA.item.uid;
      setMockStarredFolders([folderUid]);
      setMockStarredPluginKind(widgetsServed.group, widgetsServed.kind, ['w1']);
      config.bootData.navTree.push({ id: 'widgets', text: 'Widgets', url: '/a/test-widgets-app/widgets' });
      server.use(
        getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED, widgetsServed),
        // Both titles sort before the dashboard's and the folder's, and the widget's before the thing's
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'BBB Thing' }]),
        getKindSearchHandler(widgetsServed, [{ name: 'w1', title: 'AAA Widget' }])
      );
      setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(THING_ROW)).toHaveTextContent('BBB Thing');
      });
      // Kind grouping wins over the alphabet
      expect(starredRowIds()).toEqual([
        DASHBOARD_ROW,
        `synced-starred/folder/${folderUid}`,
        THING_ROW,
        'synced-starred/widgets.ext.grafana.app/Widget/w1',
      ]);
    });

    it('links it under the app sub url, whatever the plugin page url carries', async () => {
      // The name is a path segment of the link, so it is encoded
      const name = 'a b/c';
      setMockStarredPluginKind(THING_GROUP, THING_KIND, [name]);
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
      // As the backend ships the page: under the sub url, here with a query and a trailing slash
      config.bootData.navTree = [
        { id: 'starred', text: 'Starred', children: [] },
        { ...MOCK_STARRED_KIND_PAGE, url: '/grafana/a/test-things-app/things/?orgId=1' },
      ];
      server.use(
        getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED),
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name, title: 'My Thing' }])
      );

      try {
        render(<TestHarness />);

        expect(await screen.findByText('My Thing')).toHaveAttribute(
          'data-url',
          '/grafana/a/test-things-app/things/a%20b%2Fc'
        );
      } finally {
        locationUtil.initialize({
          config: { appSubUrl: '' } as GrafanaConfig,
          getTimeRangeForUrl: jest.fn(),
          getVariablesUrlParams: jest.fn(),
        });
      }
    });

    it.each([
      { desc: 'is not served by the instance', served: [], pages: [MOCK_STARRED_KIND_PAGE] },
      {
        desc: 'has no plugin page ending in its plural',
        served: [MOCK_STARRED_KIND_SERVED],
        pages: [{ id: 'other', text: 'Other', url: '/a/test-things-app/other' }],
      },
      {
        desc: 'has a page ending in its plural in two plugins',
        served: [MOCK_STARRED_KIND_SERVED],
        pages: [MOCK_STARRED_KIND_PAGE, { id: 'more', text: 'More things', url: '/a/another-app/things' }],
      },
    ])('lists the dashboards without it, and without an error, when its kind $desc', async ({ served, pages }) => {
      config.bootData.navTree = [{ id: 'starred', text: 'Starred', children: [] }, ...pages];
      server.use(
        getKindDiscoveryHandler(...served),
        // Answers for the object, were its kind searched after all
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'My Thing' }])
      );

      render(<TestHarness />);

      await waitFor(() => {
        expect(starredRowIds()).toEqual([DASHBOARD_ROW]);
      });
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
      expect(screen.getByTestId('error-state')).toHaveTextContent('false');
    });

    it("lists a starred dashboard once, as Grafana's own, though a plugin page ends in the dashboards plural", async () => {
      const dashboardsServed = {
        group: 'dashboard.grafana.app',
        version: 'v1beta1',
        kind: 'Dashboard',
        plural: 'dashboards',
      };
      config.bootData.navTree.push({
        id: 'plugin-dashboards',
        text: 'Dashboards',
        url: '/a/test-things-app/dashboards',
      });
      server.use(
        getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED, dashboardsServed),
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: THING_UUID, title: 'My Thing' }]),
        // Answers for the dashboard, were it taken for a plugin kind
        getKindSearchHandler(dashboardsServed, [{ name: dashUid, title: 'Plugin copy' }])
      );

      render(<TestHarness />);

      await waitFor(() => {
        expect(starredRowIds()).toEqual([DASHBOARD_ROW, THING_ROW]);
      });
      expect(screen.getByTestId(DASHBOARD_ROW)).toHaveAttribute('data-url', `/d/${dashUid}`);
    });

    it.each([
      {
        desc: "the kind's search",
        handlers: [
          getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED),
          http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 503 })),
        ],
      },
      { desc: 'API discovery', handlers: [http.get('/apis', () => new HttpResponse(null, { status: 503 }))] },
    ])('keeps dashboards in the nav and reports no error when $desc is unavailable', async ({ handlers }) => {
      server.use(...handlers);
      jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<TestHarness />);

      await waitFor(() => {
        expect(starredRowIds()).toEqual([DASHBOARD_ROW]);
      });
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
      // A plugin kind's API is served by the plugin and may be absent: not an error, the object is simply not shown
      expect(screen.getByTestId('error-state')).toHaveTextContent('false');
    });
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
