import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { GrafanaConfig, locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { useSelector } from 'app/types/store';

import { StarToolbarButton } from './StarToolbarButton';

const [_, { dashbdD, folderA_folderB_dashbdB }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();
locationUtil.initialize({
  config: { appSubUrl: '/foo/bar' } as GrafanaConfig,
  getTimeRangeForUrl: jest.fn(),
  getVariablesUrlParams: jest.fn(),
});

/**
 * Test component that renders the list of starred items from the nav tree state
 *
 * This is just for basic assertions that we've added/removed items correctly
 */
const TestStarredMenuItems = () => {
  const navTree = useSelector((state) => state.navBarTree);
  const starred = navTree.find((item) => item.id === 'starred');
  return (
    <div>
      {starred?.children?.map((child) => (
        <a key={child.id} href={child.url} data-testid={`starred-item-${child.text}`}>
          {child.text}
        </a>
      ))}
    </div>
  );
};

const existingStarredItem = dashbdD.item;
const itemToStar = folderA_folderB_dashbdB.item;

const findStarButton = (title: string, isStarred: boolean) =>
  screen.findByRole('button', { name: new RegExp(`^${isStarred ? 'unmark' : 'mark'} "${title}" as favorite`, 'i') });

const setup = (dashboardForStarButton: typeof existingStarredItem | typeof itemToStar) => {
  config.bootData.navTree = [
    {
      id: 'starred',
      text: 'Starred',
      children: [
        {
          text: existingStarredItem.title,
          id: `starred/${existingStarredItem.uid}`,
          url: existingStarredItem.url,
        },
      ],
    },
  ];
  return render(
    <>
      <TestStarredMenuItems />
      <StarToolbarButton
        title={dashboardForStarButton.title}
        group="dashboard.grafana.app"
        kind="Dashboard"
        id={dashboardForStarButton.uid}
      />
    </>
  );
};

const fixtures: Array<
  [
    // Test title
    string,
    // Feature toggle setup
    Parameters<typeof testWithFeatureToggles>[0],
  ]
> = [
  ['app platform APIs enabled', { enable: ['starsFromAPIServer'] }],
  ['app platform APIs disabled', {}],
];
describe('StarToolbarButton', () => {
  describe.each(fixtures)('%s', (_title, featureToggleSetup) => {
    testWithFeatureToggles(featureToggleSetup);

    it('adds a nav menu item, including correct url', async () => {
      const { user } = setup(itemToStar);
      const expectedTestId = `starred-item-${itemToStar.title}`;

      expect(screen.queryByTestId(expectedTestId)).not.toBeInTheDocument();

      await user.click(await findStarButton(itemToStar.title, false));

      const navItem = await screen.findByTestId(expectedTestId);

      expect(navItem).toBeInTheDocument();
      expect(navItem).toHaveAttribute('href', `/foo/bar/d/${itemToStar.uid}`);
    });

    it('removes a nav menu item', async () => {
      const { user } = setup(existingStarredItem);
      const expectedTestId = `starred-item-${existingStarredItem.title}`;

      expect(await screen.findByTestId(expectedTestId)).toBeInTheDocument();

      await user.click(await findStarButton(existingStarredItem.title, true));

      expect(screen.queryByTestId(expectedTestId)).not.toBeInTheDocument();
    });

    it('shows spinner initially and transitions to empty star when loading completes with no starred items', async () => {
      setup(itemToStar);
      const button = screen.getByTestId(selectors.components.NavToolbar.markAsFavorite);

      // Initially, button should be disabled (loading state)
      expect(button).toBeDisabled();

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(button).not.toBeDisabled();
        },
        { timeout: 3000 }
      );

      // After loading, should show "Mark as favorite" (empty star state)
      expect(await findStarButton(itemToStar.title, false)).toBeInTheDocument();
    });

    it('shows spinner initially and transitions to filled star when loading completes with starred item', async () => {
      setup(existingStarredItem);
      const button = screen.getByTestId(selectors.components.NavToolbar.markAsFavorite);

      // Initially, button should be disabled (loading state)
      expect(button).toBeDisabled();

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(button).not.toBeDisabled();
        },
        { timeout: 3000 }
      );

      // After loading, should show "Unmark as favorite" (filled star state)
      expect(await findStarButton(existingStarredItem.title, true)).toBeInTheDocument();
    });
  });
});
