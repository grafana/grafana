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
  testWithFeatureToggles({ enable: [] });

  it('maps selection uid to onChange', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <DashboardPicker
        value=""
        onChange={onChange}
        item={
          { settings: { placeholder: 'Choose', isClearable: true } } as Parameters<typeof DashboardPicker>[0]['item']
        }
        context={{ data: [] }}
      />
    );

    await user.type(screen.getByRole('combobox'), folderA_dashbdD.item.title);
    await user.click(await screen.findByText(`${folderA.item.title}/${folderA_dashbdD.item.title}`));

    expect(onChange).toHaveBeenCalledWith(folderA_dashbdD.item.uid);
  });
});
