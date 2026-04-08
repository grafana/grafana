import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardPicker } from './DashboardPicker';

setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA, folderA_dashbdD }] = getFolderFixtures();

describe('DashboardPicker', () => {
  describe('using app platform', () => {
    const onChange = jest.fn();

    testWithFeatureToggles({ enable: [] });

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
    testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });
    it('renders dashboard correctly', async () => {
      render(<DashboardPicker value="v2-special-case-override" />);
      expect(await screen.findByText('TODO')).toBeInTheDocument();
    });
  });
});
