import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { FOLDER_BY_NAME_URL, PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { ManagerKind } from 'app/features/apiserver/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { type DashboardViewItem } from 'app/features/search/types';

import { FolderRepo } from './FolderRepo';

setupProvisioningMswServer();

const REPOSITORY: RepositoryView = {
  name: 'repo-1',
  title: 'My Repo',
  type: 'github',
  url: 'https://github.com/grafana/repo',
  branch: 'main',
  target: 'folder',
  workflows: ['write'],
};

// Root folder of a `folder`-target repository: its uid is the repository name.
const ROOT_FOLDER: DashboardViewItem = {
  kind: 'folder',
  uid: 'repo-1',
  title: 'Repo root',
  managedBy: ManagerKind.Repo,
  managerId: 'repo-1',
};

/** Override the frontend settings endpoint that `useGetResourceRepositoryView` reads from. */
function mockRepositories(repositories: RepositoryView[]) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: repositories })));
}

describe('FolderRepo', () => {
  let originalProvisioning: boolean;
  let originalIsEditor: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    originalIsEditor = contextSrv.isEditor;
    config.provisioningEnabled = true;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
    contextSrv.isEditor = originalIsEditor;
  });

  it.each([
    { name: 'no folder', folder: undefined },
    { name: 'a nested tree row', folder: { ...ROOT_FOLDER, parentUID: 'parent-folder' } },
    { name: 'an unmanaged folder', folder: { ...ROOT_FOLDER, managedBy: undefined, managerId: undefined } },
  ])('renders nothing for $name', ({ folder }) => {
    render(<FolderRepo folder={folder} />);

    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'an item with a manager id', folder: ROOT_FOLDER },
    { name: 'a legacy item without a manager id', folder: { ...ROOT_FOLDER, managerId: undefined } },
  ])('hides the badge on an instance-managed setup for $name', async ({ folder }) => {
    mockRepositories([{ ...REPOSITORY, target: 'instance' }]);

    render(<FolderRepo folder={folder} />);

    await waitFor(() => expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument());
  });

  it('resolves the repository from the manager id without requesting the folder', async () => {
    let folderRequests = 0;
    server.use(
      http.get(FOLDER_BY_NAME_URL, () => {
        folderRequests += 1;
        return HttpResponse.json({}, { status: 404 });
      })
    );
    mockRepositories([REPOSITORY]);
    // Top-level folder of a folderless repository: its uid is not the repository name, so only
    // the manager id can identify the repository.
    const folder: DashboardViewItem = { ...ROOT_FOLDER, uid: 'abc123' };

    const { user } = render(<FolderRepo folder={folder} />);
    await user.hover(screen.getByTestId('icon-exchange-alt'));

    expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
    expect(folderRequests).toBe(0);
  });

  it('falls back to the repository name in the tooltip when it has no title', async () => {
    mockRepositories([{ ...REPOSITORY, title: '' }]);

    const { user } = render(<FolderRepo folder={ROOT_FOLDER} />);
    await user.hover(screen.getByTestId('icon-exchange-alt'));

    expect(await screen.findByText('Managed by: Repository repo-1')).toBeInTheDocument();
  });

  it('renders the generic repository badge for a legacy item without a manager id', async () => {
    mockRepositories([REPOSITORY]);

    const { user } = render(<FolderRepo folder={{ ...ROOT_FOLDER, managerId: undefined }} />);
    await user.hover(screen.getByTestId('icon-exchange-alt'));

    expect(await screen.findByText('Managed by: Repository')).toBeInTheDocument();
  });

  it('renders the read-only badge when the repository has no workflows', async () => {
    mockRepositories([{ ...REPOSITORY, workflows: [] }]);

    render(<FolderRepo folder={ROOT_FOLDER} />);

    expect(await screen.findByText('Read only')).toBeInTheDocument();
  });

  it('renders the orphaned badge when the manager id names a deleted repository', async () => {
    mockRepositories([{ ...REPOSITORY, name: 'other-repo' }]);

    const { user } = render(<FolderRepo folder={ROOT_FOLDER} />);

    const orphanedBadge = await screen.findByTestId('icon-exclamation-triangle');
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
    await user.hover(orphanedBadge);
    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it('keeps the plain badge instead of the orphaned one while the repository lookup is pending', () => {
    server.use(
      http.get(`${BASE}/settings`, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [] });
      })
    );

    render(<FolderRepo folder={ROOT_FOLDER} />);

    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-exclamation-triangle')).not.toBeInTheDocument();
  });

  it('links to the folder in the repository tree when repository actions are enabled', async () => {
    contextSrv.isEditor = true;
    mockRepositories([REPOSITORY]);

    const { user } = render(<FolderRepo folder={ROOT_FOLDER} enableRepositoryLink sourcePath="dashboards" />);
    await user.click(await screen.findByRole('button', { name: 'Managed by: Repository My Repo' }));

    expect(await screen.findByRole('menuitem', { name: /view source file/i })).toHaveAttribute(
      'href',
      'https://github.com/grafana/repo/tree/main/dashboards'
    );
  });
});
