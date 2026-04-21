import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { FolderFilter } from './FolderFilter';
const [_, { folderA, folderB }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();
comboboxTestSetup();

describe('FolderFilter', () => {
  it('allows selecting folders', async () => {
    const onChange = jest.fn();
    const { user } = render(<FolderFilter onChange={onChange} />);

    await user.click(screen.getByPlaceholderText('Filter by folder'));

    await user.click(await screen.findByText(folderA.item.title));
    await user.click(await screen.findByText(folderB.item.title));
    expect(onChange).toHaveBeenCalledWith([folderA.item.uid, folderB.item.uid]);
  });
});
