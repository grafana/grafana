import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  getFolderFixtures,
  setMockStarredDashboards,
  setMockStarredFolders,
  setTestFlags,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { useSelector } from 'app/types/store';

import { useStarItem, useSyncStarredItemsInNav } from './hooks';

jest.mock('app/features/search/service/searcher');

const mockedGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);

const [_, { dashbdD, folderA_dashbdD, folderA }] = getFolderFixtures();
// The starred fixtures are: dashbdD.item.uid, folderA_dashbdD.item.uid
const starredDashboards = [dashbdD.item, folderA_dashbdD.item];

setBackendSrv(backendSrv);
setupMockServer();

/** Renders the hook plus a read-only component that reflects Redux starred state */
const TestHarness = () => {
  const { isLoading, isError } = useSyncStarredItemsInNav();
  const navTree = useSelector((state) => state.navBarTree);
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <span data-testid="loading-state">{String(isLoading)}</span>
      <span data-testid="error-state">{String(isError)}</span>
      <ul data-testid="starred-list">
        {starred?.children?.map((child) => (
          <li key={child.id} data-testid={`synced-${child.id}`} data-icon={child.icon}>
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
  const navTree = useSelector((state) => state.navBarTree);
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <>
      <button
        onClick={async () => {
          await starItem({ id: uid, title: 'My Folder' }, true);
          setStarDone(true);
        }}
      >
        star folder
      </button>
      <span data-testid="star-done">{String(starDone)}</span>
      <ul data-testid="starred-list">
        {starred?.children?.map((child) => (
          <li key={child.id} data-testid={`synced-${child.id}`}>
            {child.text}
          </li>
        ))}
      </ul>
    </>
  );
};

function setupSearchMock(items: Array<{ uid: string; name: string; url: string; kind: string }>) {
  const view = {
    length: items.length,
    get: (i: number) => items[i],
    dataFrame: { fields: [], length: items.length },
  };
  const mockSearcher = {
    search: jest.fn().mockResolvedValue({
      view,
      totalRows: items.length,
      isItemLoaded: () => true,
      loadMoreItems: () => Promise.resolve(),
    }),
    starred: jest.fn(),
    tags: jest.fn(),
    getSortOptions: jest.fn(),
    getLocationInfo: jest.fn(),
    getFolderViewSort: jest.fn().mockReturnValue('name_sort'),
  };
  mockedGetGrafanaSearcher.mockReturnValue(mockSearcher);
  return mockSearcher;
}

const fixtures: Array<[string, Parameters<typeof testWithFeatureToggles>[0]]> = [
  ['starsFromAPIServer enabled', { enable: ['starsFromAPIServer'] }],
  ['starsFromAPIServer disabled', {}],
];

describe('useSyncStarredItemsInNav', () => {
  describe.each(fixtures)('%s', (_title, featureToggleSetup) => {
    testWithFeatureToggles(featureToggleSetup);

    beforeEach(() => {
      // Provide a starred section in the nav tree so the reducer has a target
      config.bootData.navTree = [
        { id: 'home', text: 'Home', url: '/' },
        { id: 'starred', text: 'Starred', children: [] },
      ];
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
        });
      });

      // Verify items appeared in the nav tree (sorted alphabetically). Per-kind icons are
      // gated behind starredFoldersEnabled(): with starred folders disabled, synced rows
      // must carry no icon at all (nav is unchanged from pre-feature behavior).
      for (const dash of starredDashboards) {
        await waitFor(() => {
          expect(screen.getByTestId(`synced-starred/${dash.uid}`)).toBeInTheDocument();
        });
        expect(screen.getByTestId(`synced-starred/${dash.uid}`)).not.toHaveAttribute('data-icon');
      }

      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });

    it('dispatches empty items when no stars exist', async () => {
      const { http, HttpResponse } = await import('msw');
      server.use(
        // Legacy empty
        http.get('/api/user/stars', () => HttpResponse.json([])),
        // App platform empty
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
  });

  describe('when starredFolders is enabled', () => {
    testWithFeatureToggles({ enable: ['starsFromAPIServer', 'foldersAppPlatformAPI'] });

    beforeEach(() => {
      setTestFlags({ 'grafana.starredFolders': true });
      // Provide a starred section in the nav tree so the reducer has a target
      config.bootData.navTree = [
        { id: 'home', text: 'Home', url: '/' },
        { id: 'starred', text: 'Starred', children: [] },
      ];
    });

    afterEach(() => {
      setTestFlags({});
    });

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

      // One combined search across both kinds, keyed by the sorted union of starred uids
      await waitFor(() => {
        expect(mockSearcher.search).toHaveBeenCalledWith({
          name: [dashUid, folderUid].sort(),
          kind: ['dashboard', 'folder'],
        });
      });

      // Both kinds land in the nav Starred section
      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/${dashUid}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId(`synced-starred/${folderUid}`)).toBeInTheDocument();

      // ...and carry the icon that distinguishes them
      expect(screen.getByTestId(`synced-starred/${dashUid}`)).toHaveAttribute('data-icon', 'apps');
      expect(screen.getByTestId(`synced-starred/${folderUid}`)).toHaveAttribute('data-icon', 'folder');
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
        expect(screen.getByTestId(`synced-starred/${folderUid}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId(`synced-starred/${dashUid}`)).toBeInTheDocument();

      // DOM order mirrors nav children order: the dashboard row renders before the folder row
      const rowIds = Array.from(screen.getByTestId('starred-list').children).map((el) =>
        el.getAttribute('data-testid')
      );
      expect(rowIds).toEqual([`synced-starred/${dashUid}`, `synced-starred/${folderUid}`]);
    });

    it('drops a search row whose uid was starred as a different kind', async () => {
      const dashUid = dashbdD.item.uid;
      const folderUid = folderA.item.uid;
      // dashUid is starred as a dashboard ONLY; the folder star set holds a different uid,
      // so the per-kind filter must be keyed by kind rather than by mere star existence.
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);

      // The single search matches the uid union against BOTH kinds, so it can return an
      // UNSTARRED folder that happens to share the starred dashboard's uid. That bogus row
      // is deliberately last: setStarredItems keeps the last item per uid, so without the
      // per-kind post-filter it would replace the legit dashboard row in the nav.
      setupSearchMock([
        { uid: dashUid, name: 'My Dashboard', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'My Folder', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
        { uid: dashUid, name: 'Bogus Folder', url: `/dashboards/f/${dashUid}`, kind: 'folder' },
      ]);

      render(<TestHarness />);

      await waitFor(() => {
        expect(screen.getByTestId(`synced-starred/${folderUid}`)).toBeInTheDocument();
      });

      // Exactly one row for the colliding uid, and it is the dashboard — not the unstarred folder
      const collisionRows = screen.getAllByTestId(`synced-starred/${dashUid}`);
      expect(collisionRows).toHaveLength(1);
      expect(collisionRows[0]).toHaveAttribute('data-icon', 'apps');
      expect(collisionRows[0]).toHaveTextContent('My Dashboard');
      expect(screen.queryByText('Bogus Folder')).not.toBeInTheDocument();

      // ...while the genuinely starred folder is untouched by the filter
      expect(screen.getByTestId(`synced-starred/${folderUid}`)).toHaveAttribute('data-icon', 'folder');
      expect(screen.getByTestId('starred-list').children).toHaveLength(2);
    });

    it('searches for and renders a uid starred as both kinds exactly once', async () => {
      const uid = dashbdD.item.uid;
      // The SAME uid sits in both per-kind star sets
      setMockStarredDashboards([uid]);
      setMockStarredFolders([uid]);

      const mockSearcher = setupSearchMock([{ uid, name: 'My Dashboard', url: `/d/${uid}`, kind: 'dashboard' }]);

      render(<TestHarness />);

      // The union of the per-kind star sets is deduped: the uid lands in `name` exactly once
      await waitFor(() => {
        expect(mockSearcher.search).toHaveBeenCalledWith({
          name: [uid],
          kind: ['dashboard', 'folder'],
        });
      });

      // ...and occupies exactly one nav row instead of one per star record
      await waitFor(() => {
        expect(screen.getAllByTestId(`synced-starred/${uid}`)).toHaveLength(1);
      });
      expect(screen.getByTestId('starred-list').children).toHaveLength(1);
    });
  });
});

describe('useStarItem', () => {
  // starsFromAPIServer alone: the folder gates (grafana.starredFolders flag, foldersAppPlatformAPI)
  // stay off, so kind Folder must never surface in the nav Starred section.
  describe('with starsFromAPIServer on and starred folders disabled', () => {
    testWithFeatureToggles({ enable: ['starsFromAPIServer'] });

    beforeEach(() => {
      // Provide a starred section in the nav tree so the reducer has a target
      config.bootData.navTree = [
        { id: 'home', text: 'Home', url: '/' },
        { id: 'starred', text: 'Starred', children: [] },
      ];
    });

    it('stars a folder without adding it to the nav starred section', async () => {
      const folderUid = folderA.item.uid;
      setMockStarredFolders([]);

      const { user } = render(<StarFolderHarness uid={folderUid} />);

      await user.click(screen.getByRole('button', { name: 'star folder' }));

      // The star mutation round-trip finished...
      await waitFor(() => {
        expect(screen.getByTestId('star-done')).toHaveTextContent('true');
      });

      // ...but the gated-out kind dispatched nothing into the nav tree
      expect(screen.queryByTestId(`synced-starred/${folderUid}`)).not.toBeInTheDocument();
      expect(screen.getByTestId('starred-list').children).toHaveLength(0);
    });
  });

  // Folder gates on: a successful star would land in the nav, so a rejected one must not.
  describe('with starsFromAPIServer on and starred folders enabled', () => {
    testWithFeatureToggles({ enable: ['starsFromAPIServer', 'foldersAppPlatformAPI'] });

    beforeEach(() => {
      setTestFlags({ 'grafana.starredFolders': true });
      // Provide a starred section in the nav tree so the reducer has a target
      config.bootData.navTree = [
        { id: 'home', text: 'Home', url: '/' },
        { id: 'starred', text: 'Starred', children: [] },
      ];
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('leaves the nav starred section untouched when the server rejects the star', async () => {
      const folderUid = folderA.item.uid;
      setMockStarredFolders([]);

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
      expect(screen.queryByTestId(`synced-starred/${folderUid}`)).not.toBeInTheDocument();
      expect(screen.getByTestId('starred-list').children).toHaveLength(0);
    });
  });
});
