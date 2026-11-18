import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { type DashboardViewItem } from 'app/features/search/types';

import { NestedFolderList, type NestedFolderListProps } from './NestedFolderList';

setupProvisioningMswServer();

// A read-only `folder`-target repository: no write workflows.
const READ_ONLY_REPOSITORY: RepositoryView = {
  name: 'repo-1',
  title: 'My Repo',
  type: 'github',
  url: 'https://github.com/grafana/repo',
  branch: 'main',
  target: 'folder',
  workflows: [],
};

// Root folder of the repository above: its uid is the repository name.
const PROVISIONED_FOLDER: DashboardsTreeItem<DashboardViewItem> = {
  item: {
    kind: 'folder',
    uid: 'repo-1',
    title: 'Repo root',
    managedBy: ManagerKind.Repo,
    managerId: 'repo-1',
  },
  level: 0,
  isOpen: false,
};

const NESTED_PROVISIONED_FOLDER: DashboardsTreeItem<DashboardViewItem> = {
  item: {
    ...PROVISIONED_FOLDER.item,
    uid: 'nested-folder',
    title: 'Nested folder',
    parentUID: PROVISIONED_FOLDER.item.uid,
  },
  level: 1,
  isOpen: false,
  parentUID: PROVISIONED_FOLDER.item.uid,
};

function renderList(props: Partial<NestedFolderListProps> = {}) {
  return render(
    <NestedFolderList
      items={[PROVISIONED_FOLDER]}
      focusedItemIndex={-1}
      foldersAreOpenable={false}
      idPrefix="test"
      selectedFolder={undefined}
      onFolderExpand={jest.fn()}
      onFolderSelect={jest.fn()}
      isItemLoaded={() => true}
      requestLoadMore={jest.fn()}
      emptyFolders={new Set()}
      {...props}
    />
  );
}

describe('NestedFolderList', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    config.provisioningEnabled = true;
    server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: [READ_ONLY_REPOSITORY] })));
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  it('shows the read-only badge on a provisioned folder row when the user can edit', async () => {
    renderList({ canEdit: true });

    expect(await screen.findByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('keeps the managed badge but hides the read-only badge when the user cannot edit', async () => {
    renderList({ canEdit: false });

    expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('shows the managed badge for a nested search result', async () => {
    renderList({ items: [NESTED_PROVISIONED_FOLDER], foldersAreOpenable: false });

    expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('hides the managed badge for a nested browse row', () => {
    renderList({ items: [NESTED_PROVISIONED_FOLDER], foldersAreOpenable: true });

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });
});
