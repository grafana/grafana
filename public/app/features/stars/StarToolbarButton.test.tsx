import { render, screen } from 'test/test-utils';

import { GrafanaConfig, locationUtil } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { useSelector } from 'app/types/store';

import { testWithFeatureToggles } from '../alerting/unified/test/test-utils';

import { StarToolbarButton } from './StarToolbarButton';

const [_, { dashbdD, folderA_folderB_dashbdB }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();
locationUtil.initialize({
  config: { appSubUrl: '/foo/bar' } as GrafanaConfig,
  getTimeRangeForUrl: jest.fn(),
  getVariablesUrlParams: jest.fn(),
});

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
    // Enabled feature toggles
    Parameters<typeof testWithFeatureToggles>[0],
  ]
> = [
  ['app platform APIs enabled', ['starsFromAPIServer']],
  ['app platform APIs disabled', []],
];
describe('StarToolbarButton', () => {
  describe.each(fixtures)('%s', (_title, featureToggles) => {
    testWithFeatureToggles(featureToggles);

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
  });
});
