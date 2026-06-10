import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { useSelector } from 'app/types/store';

import { useSyncStarredItemsInNav } from './hooks';

jest.mock('app/features/search/service/searcher');

const mockedGetGrafanaSearcher = jest.mocked(getGrafanaSearcher);

const [_, { dashbdD, folderA_dashbdD }] = getFolderFixtures();
// The starred fixtures are: dashbdD.item.uid, folderA_dashbdD.item.uid
const starredDashboards = [dashbdD.item, folderA_dashbdD.item];

setBackendSrv(backendSrv);
setupMockServer();

/** Renders the hook plus a read-only component that reflects Redux starred state */
const TestHarness = () => {
  useSyncStarredItemsInNav();
  const navTree = useSelector((state) => state.navBarTree);
  const starred = navTree.find((item) => item.id === 'starred');

  return (
    <ul data-testid="starred-list">
      {starred?.children?.map((child) => (
        <li key={child.id} data-testid={`synced-${child.id}`}>
          {child.text}
        </li>
      ))}
    </ul>
  );
};

function setupSearchMock(items: Array<{ uid: string; name: string; url: string }>) {
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
        }))
      );

      render(<TestHarness />);

      await waitFor(() => {
        expect(mockSearcher.search).toHaveBeenCalledWith({
          name: starredDashboards.map((d) => d.uid).sort(),
          kind: ['dashboard'],
        });
      });

      // Verify items appeared in the nav tree (sorted alphabetically)
      for (const dash of starredDashboards) {
        await waitFor(() => {
          expect(screen.getByTestId(`synced-starred/${dash.uid}`)).toBeInTheDocument();
        });
      }
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
    });
  });
});
