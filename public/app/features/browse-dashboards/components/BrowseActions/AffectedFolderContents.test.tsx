import { HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { customFolderCountsHandler, getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { AffectedFolderContents } from './AffectedFolderContents';

setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA }] = getFolderFixtures();

const emptySelection = {
  folder: {},
  dashboard: {},
};

const folderASelection = {
  folder: { [folderA.item.uid]: true },
  dashboard: {},
};

describe('AffectedFolderContents', () => {
  it('always renders the default message', () => {
    render(<AffectedFolderContents selectedItems={emptySelection} defaultMessage={<p>Default body</p>} />);

    expect(screen.getByText('Default body')).toBeInTheDocument();
  });

  it('does not render empty/non-empty alerts when no folder is selected', () => {
    render(
      <AffectedFolderContents
        selectedItems={emptySelection}
        emptyMessage="Folder is empty"
        nonEmptyMessage="Folder has resources"
      />
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the non-empty warning alert when the selected folder has descendants', async () => {
    render(<AffectedFolderContents selectedItems={folderASelection} nonEmptyMessage="Folder has other resources" />);

    expect(await screen.findByRole('alert', { name: 'Folder has other resources' })).toBeInTheDocument();
  });

  it('renders the empty success alert when the selected folder has no descendants', async () => {
    server.use(
      customFolderCountsHandler(() =>
        HttpResponse.json({ folders: 0, dashboards: 0, library_elements: 0, alertrules: 0 })
      )
    );

    render(<AffectedFolderContents selectedItems={folderASelection} emptyMessage="Folder is empty" />);

    expect(await screen.findByRole('status', { name: 'Folder is empty' })).toBeInTheDocument();
  });
});
