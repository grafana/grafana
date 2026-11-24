import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { testWithStarsUser } from 'test/helpers/testWithStarsUser';
import { render, screen, waitFor } from 'test/test-utils';

import { type GlobalSearchQuery } from '@grafana/api-clients/rtkq/search/v0alpha1';
import { AppEvents } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { getAPIGroupHandler, getKindSearchHandler, kindSearchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  getFolderFixtures,
  MOCK_STARRED_KIND_SERVED,
  setMockStarredDashboards,
  setMockStarredFolders,
  setMockStarredPluginKind,
} from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type GrafanaSearcher, type SearchQuery } from 'app/features/search/service/types';
import { useStarItem, useStarredSearchWithAppKinds } from 'app/features/stars/hooks';

import { useNavTree } from './useNavTree';

jest.mock('app/features/search/service/searcher');

const mockedGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);

const [_, { dashbdD, folderA_dashbdD, folderA }] = getFolderFixtures();
// The starred fixtures are: dashbdD.item.uid, folderA_dashbdD.item.uid
const starredDashboards = [dashbdD.item, folderA_dashbdD.item];
// A plugin kind's name is whatever its API uses; a Page's is a UUID
const PAGE_UUID = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';
const OTHER_PAGE_UUID = 'a2d9f0c4-6f1b-4c0e-8a57-3e9b1d7c5f20';
const PAGE_URL = `/a/grafana-assistant-app/pages/${PAGE_UUID}`;
const { group: PAGE_GROUP, kind: PAGE_KIND } = MOCK_STARRED_KIND_SERVED;
const PAGE_ROW = `synced-starred/${PAGE_GROUP}/${PAGE_KIND}/${PAGE_UUID}`;
// A version the Page kind is no longer searched at, for a group that still prefers it
const RETIRED_VERSION = 'v0alpha0';

setBackendSrv(backendSrv);
setupMockServer();

/** Serves the Page kind's API group, so the kind resolves through its own search. */
function servePages() {
  server.use(getAPIGroupHandler(PAGE_GROUP, MOCK_STARRED_KIND_SERVED.version));
}

/** Holds the Page search open until `answer` is called; it then finds the starred Page. */
function holdPageSearch() {
  let answer = () => {};
  const held = new Promise<void>((resolve) => {
    answer = resolve;
  });
  const asked = jest.fn(async () => {
    await held;
    return HttpResponse.json({
      metadata: { totalHits: 1, totalHitsRelation: 'eq' },
      items: [
        {
          resource: { group: PAGE_GROUP, resource: 'pages', kind: PAGE_KIND, name: PAGE_UUID },
          fields: { title: 'My Page' },
        },
      ],
    });
  });
  server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), asked));
  return { asked, answer };
}

/** Renders the tree plus the starred search status, with a read-only list of the tree's starred children */
const TestHarness = () => {
  const navTree = useNavTree();
  const { loading: starredLoading, error: starredError, refetch } = useStarredSearchWithAppKinds();
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <button onClick={refetch}>search again</button>
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
    // The backend ships the Starred section empty; the hook fills its children
    config.bootData.navTree = [
      { id: 'home', text: 'Home', url: '/' },
      { id: 'starred', text: 'Starred', children: [] },
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

  it('asks for the API of an app kind only once the stars hold one of its objects, then lists it', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    const group = jest.fn(() => new HttpResponse(null, { status: 404 }));
    server.use(http.get(`/apis/${PAGE_GROUP}/`, group));
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    const { unmount } = render(<TestHarness />);

    // Dashboards alone ask nothing of a plugin
    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });
    expect(group).not.toHaveBeenCalled();
    unmount();

    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: PAGE_UUID, title: 'My Page' }]));

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(PAGE_ROW)).toHaveTextContent('My Page');
    });
    expect(screen.getByTestId(PAGE_ROW)).toHaveAttribute('data-url', PAGE_URL);
    expect(screen.getByTestId(PAGE_ROW)).toHaveAttribute('data-icon', 'cube');
  });

  it('asks the kind search for the starred names alone', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    const queries: unknown[] = [];
    server.use(
      http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), async ({ request }) => {
        queries.push(await request.json());
        return HttpResponse.json({ metadata: { totalHits: 0, totalHitsRelation: 'eq' }, items: [] });
      })
    );
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(queries).toHaveLength(1);
    });
    // The server decodes strictly, so the whole body is the contract
    expect(queries).toEqual([
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { filter: { field: 'name', operator: 'In', values: [PAGE_UUID] } },
        fields: ['title', 'folder', 'description', 'tags'],
        limit: 1,
      },
    ]);
  });

  it('names a plugin row after the object when it has no title', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: PAGE_UUID, title: '' }]));
    setupSearchMock([]);

    render(<TestHarness />);

    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent(PAGE_UUID);
  });

  it('lists every plugin row of a star set larger than one page of the kind search', async () => {
    const names = Array.from({ length: 501 }, (_, index) => `p${index}`);
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, names);
    servePages();
    server.use(
      getKindSearchHandler(
        MOCK_STARRED_KIND_SERVED,
        names.map((name) => ({ name, title: name }))
      )
    );
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('starred-list').children).toHaveLength(501);
    });
  });

  it('asks the kind search again when a page stops short of the starred names', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID, OTHER_PAGE_UUID]);
    servePages();
    const item = (name: string, title: string) => ({
      resource: { group: PAGE_GROUP, resource: 'pages', kind: PAGE_KIND, name },
      fields: { title },
    });
    const tokens: Array<string | undefined> = [];
    server.use(
      http.post<{ namespace: string }, GlobalSearchQuery>(
        kindSearchRoute(MOCK_STARRED_KIND_SERVED),
        async ({ request }) => {
          const query = await request.json();
          tokens.push(query.continue);
          // The server may cut a page short; it then hands out a token for the rest
          return HttpResponse.json(
            query.continue
              ? { metadata: { totalHits: 2, totalHitsRelation: 'lte' }, items: [item(OTHER_PAGE_UUID, 'Second page')] }
              : {
                  metadata: { totalHits: 2, totalHitsRelation: 'lte', continue: 'rest' },
                  items: [item(PAGE_UUID, 'First page')],
                }
          );
        }
      )
    );
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('starred-list').children).toHaveLength(2);
    });
    expect(tokens).toEqual([undefined, 'rest']);
  });

  it('asks the kind search once when a page holds every starred name, though it comes with a token', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID, OTHER_PAGE_UUID]);
    servePages();
    // The server hands out a token with a full page, as it cannot tell whether more would follow
    const asked = jest.fn(() =>
      HttpResponse.json({
        metadata: { totalHits: 2, totalHitsRelation: 'lte', continue: 'more' },
        items: [PAGE_UUID, OTHER_PAGE_UUID].map((name) => ({
          resource: { group: PAGE_GROUP, resource: 'pages', kind: PAGE_KIND, name },
          fields: { title: name },
        })),
      })
    );
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), asked));
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('starred-list').children).toHaveLength(2);
    });
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('stops asking a kind search that hands out a token with every page', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    const asked = jest.fn(() =>
      HttpResponse.json({ metadata: { totalHits: 1, totalHitsRelation: 'lte', continue: 'more' }, items: [] })
    );
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), asked));
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });
    // A page accounts for one name at least, so one starred name is one page at most
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      desc: 'cannot be read',
      first: http.get(`/apis/${PAGE_GROUP}/`, () => new HttpResponse(null, { status: 503 })),
    },
    { desc: 'prefers a version since retired', first: getAPIGroupHandler(PAGE_GROUP, RETIRED_VERSION) },
  ])('lists a starred plugin object on the next search, when its API group first $desc', async ({ first }) => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    server.use(
      first,
      http.post(
        kindSearchRoute({ ...MOCK_STARRED_KIND_SERVED, version: RETIRED_VERSION }),
        () => new HttpResponse(null, { status: 404 })
      ),
      getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: PAGE_UUID, title: 'My Page' }])
    );
    // A group that cannot be read is logged, and so is a search at a version no longer served
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    // The spy may be an earlier test's, with that test's calls
    error.mockClear();
    setupSearchMock([]);

    const { user } = render(<TestHarness />);
    await waitFor(() => {
      expect(error).toHaveBeenCalledTimes(1);
    });

    // The plugin is back at its current version; the version is asked for with every search, not kept
    servePages();
    await user.click(screen.getByRole('button', { name: 'search again' }));

    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent('My Page');
  });

  it('lists the starred dashboards, no longer loading, while the kind search is still out', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    const pageSearch = holdPageSearch();
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    render(<TestHarness />);

    expect(await screen.findByTestId(`synced-starred/dashboard/${dashUid}`)).toHaveTextContent('My Dashboard');
    // There are rows to show, so a plugin's API does not hold the list up
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    expect(screen.queryByTestId(PAGE_ROW)).not.toBeInTheDocument();

    pageSearch.answer();
    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent('My Page');
  });

  it('stays loading until the kind search answers, when it has the only starred objects', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    const pageSearch = holdPageSearch();
    setupSearchMock([]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(pageSearch.asked).toHaveBeenCalledTimes(1);
    });
    // Not an empty list yet: the only starred objects are still on their way
    expect(screen.getByTestId('loading-state')).toHaveTextContent('true');

    pageSearch.answer();
    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent('My Page');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
  });

  it('lists a folder starred while the kind search is still out', async () => {
    const folderUid = folderA.item.uid;
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    const pageSearch = holdPageSearch();
    setupSearchMock([{ uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' }]);

    const { user } = render(<StarFolderHarness uid={folderUid} />);
    await waitFor(() => {
      expect(pageSearch.asked).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'star folder' }));

    // A plugin's API that has yet to answer does not hold up a star made meanwhile
    expect(await screen.findByTestId(`synced-starred/folder/${folderUid}`)).toHaveTextContent('My Folder');

    pageSearch.answer();
    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent('My Page');
  });

  it.each([
    { status: 405, level: 'warn', says: 'is served without a search endpoint' },
    { status: 404, level: 'error', says: 'Failed to resolve starred assistant.ext.grafana.app/Page' },
    { status: 503, level: 'error', says: 'Failed to resolve starred assistant.ext.grafana.app/Page' },
  ] as const)(
    'keeps dashboards in the nav without an error, logging a console $level, when the kind search answers $status',
    async ({ status, level, says }) => {
      const dashUid = dashbdD.item.uid;
      setMockStarredDashboards([dashUid]);
      setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
      servePages();
      server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status })));
      const log = jest.spyOn(console, level).mockImplementation(() => {});
      // The spy may be an earlier test's, with that test's calls
      log.mockClear();
      setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
      });
      // The dashboard row does not wait for the plugin's API, which is logged once it has answered
      await waitFor(() => {
        expect(log).toHaveBeenCalledTimes(1);
      });
      expect(log.mock.calls[0][0]).toContain(says);

      // A plugin kind's API is served by the plugin and may be absent: not an error, the object is simply not shown
      expect(screen.getByTestId('error-state')).toHaveTextContent('false');
      expect(screen.queryByTestId(PAGE_ROW)).not.toBeInTheDocument();
    }
  );

  it('lists the starred plugin objects, with the error, when the search of dashboards and folders fails', async () => {
    const dashUid = dashbdD.item.uid;
    setMockStarredDashboards([dashUid]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    server.use(getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: PAGE_UUID, title: 'My Page' }]));
    setupSearchMock([]).search.mockRejectedValue(new Error('the index is down'));

    render(<TestHarness />);

    expect(await screen.findByTestId(PAGE_ROW)).toHaveTextContent('My Page');
    // The rows that loaded show, and the error tells a view that they are not all of them
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
  });

  it('drops stars of a kind the instance does not serve', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    server.use(getAPIGroupHandler(PAGE_GROUP));
    setupSearchMock([]);

    render(<TestHarness />);

    // Nothing else is starred, so the list is loading until the group has answered
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });

    // The instance has no Page API, so the star is neither searched for nor listed
    expect(screen.getByTestId('starred-list')).toBeEmptyDOMElement();
  });

  it('raises no toast when the kind search fails', async () => {
    setMockStarredDashboards([]);
    setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
    servePages();
    server.use(http.post(kindSearchRoute(MOCK_STARRED_KIND_SERVED), () => new HttpResponse(null, { status: 503 })));
    // The failed search is logged
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const alertDecided = jest.spyOn(backendSrv, 'showErrorAlert');
    const emit = jest.spyOn(appEvents, 'emit');
    setupSearchMock([]);

    render(<TestHarness />);

    // The backend service decides on an alert a moment after a request fails
    await waitFor(() => {
      expect(alertDecided).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('pages/search') }),
        expect.anything()
      );
    });
    expect(emit).not.toHaveBeenCalledWith(AppEvents.alertError, expect.anything());
  });

  it('drops stars of a kind Grafana has no page for, whatever page another plugin has at its plural', async () => {
    const dashUid = dashbdD.item.uid;
    const things = { group: 'things.ext.grafana.app', version: 'v1alpha1', kind: 'Thing', plural: 'things' };
    setMockStarredDashboards([dashUid]);
    setMockStarredPluginKind(things.group, things.kind, ['t1']);
    config.bootData.navTree = [
      { id: 'home', text: 'Home', url: '/' },
      { id: 'starred', text: 'Starred', children: [] },
      { id: 'plugin-page-unrelated-app', text: 'Things', url: '/a/unrelated-app/things', pluginId: 'unrelated-app' },
    ];
    server.use(
      getAPIGroupHandler(things.group, things.version),
      getKindSearchHandler(things, [{ name: 't1', title: 'My Thing' }])
    );
    setupSearchMock([{ uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' }]);

    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByTestId(`synced-starred/dashboard/${dashUid}`)).toBeInTheDocument();
    });

    // Nothing says where a Thing's page is, so it is not listed
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
      setMockStarredPluginKind(PAGE_GROUP, PAGE_KIND, [PAGE_UUID]);
      servePages();
      // The title sorts before both other titles, so a pure alphabetical sort would render it first
      server.use(
        getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [{ name: PAGE_UUID, title: 'AAA Page', folder: folderUid }])
      );
      const mockSearcher = setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(PAGE_ROW)).toBeInTheDocument();
      });

      // The dashboard search is asked about dashboard and folder uids only; the plugin kind resolves through its API
      expect(mockSearcher.search).toHaveBeenCalledWith({
        name: [dashUid, folderUid].sort(),
        kind: ['dashboard', 'folder'],
        limit: 4,
      });
      expect(screen.getByTestId(PAGE_ROW)).toHaveTextContent('AAA Page');

      // Kind grouping wins over the alphabet: dashboard, then folder, then the plugin kind
      const rowIds = Array.from(screen.getByTestId('starred-list').children).map((el) =>
        el.getAttribute('data-testid')
      );
      expect(rowIds).toEqual([`synced-starred/dashboard/${dashUid}`, `synced-starred/folder/${folderUid}`, PAGE_ROW]);
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
