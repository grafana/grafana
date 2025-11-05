import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardPicker } from './DashboardPicker';

setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA, folderA_dashbdD }] = getFolderFixtures();

const fixtures: Array<
  [
    // Test title
    string,
    // Feature toggle setup
    Parameters<typeof testWithFeatureToggles>[0],
  ]
> = [
  ['app platform APIs enabled', { enable: ['kubernetesDashboards'] }],
  ['app platform APIs disabled', {}],
];
describe('DashboardPicker', () => {
  describe.each(fixtures)('%s', (_title, featureToggleSetup) => {
    const onChange = jest.fn();

    testWithFeatureToggles(featureToggleSetup);

    it('should fetch and display dashboards', async () => {
      render(<DashboardPicker value={folderA_dashbdD.item.uid} />);

      expect(await screen.findByText(`${folderA.item.title}/${folderA_dashbdD.item.title}`)).toBeInTheDocument();
    });

    it('should search for dashboards and allow selection', async () => {
      const { user } = render(<DashboardPicker onChange={onChange} />);

      const expectedDash = folderA_dashbdD.item;
      const expectedFolder = folderA.item;

      await user.type(screen.getByRole('combobox'), expectedDash.title);

      expect(await screen.findByText(`${expectedFolder.title}/${expectedDash.title}`)).toBeInTheDocument();

      await user.click(screen.getByText(`${expectedFolder.title}/${expectedDash.title}`));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          folderTitle: expectedFolder.title,
          folderUid: expectedFolder.uid,
          name: expectedDash.title,
          uid: expectedDash.uid,
        })
      );
    });
  });

  xdescribe('dashboard v2 (v2beta1 API)', () => {
    testWithFeatureToggles({ enable: ['dashboardNewLayouts', 'kubernetesDashboards'] });
    it('renders dashboard correctly', async () => {
      render(<DashboardPicker value="v2-special-case-override" />);
      expect(await screen.findByText('TODO')).toBeInTheDocument();
    });
  });
});
