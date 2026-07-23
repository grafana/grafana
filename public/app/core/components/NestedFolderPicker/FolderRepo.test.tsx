import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import type * as useGetResourceRepositoryViewModule from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { type DashboardViewItem } from 'app/features/search/types';

import { FolderRepo } from './FolderRepo';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    config: { featureToggles: { provisioning: true } },
  };
});

const mockUseGetFrontendSettingsQuery = jest.fn();
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: () => mockUseGetFrontendSettingsQuery(),
}));

const mockUseGetResourceRepositoryView = jest.fn();
jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => {
  const actual = jest.requireActual<typeof useGetResourceRepositoryViewModule>(
    'app/features/provisioning/hooks/useGetResourceRepositoryView'
  );
  return {
    ...actual,
    useGetResourceRepositoryView: () => mockUseGetResourceRepositoryView(),
  };
});

function mockSettings(items: Array<Partial<RepositoryView>>) {
  mockUseGetFrontendSettingsQuery.mockReturnValue({ data: { items } });
}

function mockRepoView({
  isReadOnlyRepo = false,
  repoType = 'github',
  repository,
  status = RepoViewStatus.Ready,
}: {
  isReadOnlyRepo?: boolean;
  repoType?: string;
  repository?: { title?: string; name?: string };
  status?: RepoViewStatus;
} = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    isReadOnlyRepo,
    repoType,
    repository,
    status,
  });
}

const MOCK_FOLDER: DashboardViewItem = {
  uid: 'A',
  managedBy: ManagerKind.Repo,
  parentUID: undefined,
  kind: 'folder',
  title: 'test',
};

function setup({
  folder = undefined,
  repoViewMock = {},
  settingsMock = [],
}: {
  folder?: DashboardViewItem;
  repoViewMock?: {
    isReadOnlyRepo?: boolean;
    repoType?: string;
    repository?: { title?: string; name?: string };
    status?: RepoViewStatus;
  };
  settingsMock?: Array<Partial<RepositoryView>>;
}) {
  mockSettings(settingsMock);
  mockRepoView(repoViewMock);

  return {
    ...render(<FolderRepo folder={folder} />),
  };
}

describe('FolderRepo', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('returns null when folder is undefined', () => {
    setup({ folder: undefined });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('returns null when folder has parentUID', () => {
    setup({ folder: { ...MOCK_FOLDER, parentUID: 'repo-123' } });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('returns null when folder is not managed', () => {
    setup({ folder: { ...MOCK_FOLDER, managedBy: undefined } });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('returns null when whole instance is provisioned', () => {
    setup({ folder: MOCK_FOLDER, settingsMock: [{ target: 'instance' }] });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders Read only badge when repo is read-only (empty workflows)', () => {
    setup({ folder: MOCK_FOLDER, repoViewMock: { isReadOnlyRepo: true, repoType: 'github' } });
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('renders Provisioned badge when repository has title (tooltip shows repository title)', async () => {
    const user = userEvent.setup();
    setup({
      folder: MOCK_FOLDER,
      repoViewMock: { repository: { title: 'My Repo', name: 'repo-1' } },
    });
    const provisionedBadge = screen.getByTestId('icon-exchange-alt');
    await user.hover(provisionedBadge);
    expect(await screen.findByText('Managed by: Repository My Repo')).toBeInTheDocument();
  });

  it('renders Provisioned badge when repository has name but no title (tooltip shows repository name)', async () => {
    const user = userEvent.setup();
    setup({
      folder: MOCK_FOLDER,
      repoViewMock: { repository: { name: 'repo-1' } },
    });
    const provisionedBadge = screen.getByTestId('icon-exchange-alt');
    await user.hover(provisionedBadge);
    expect(await screen.findByText('Managed by: Repository repo-1')).toBeInTheDocument();
  });

  it('renders Provisioned badge when repository is undefined (tooltip has empty title)', async () => {
    const user = userEvent.setup();
    setup({ folder: MOCK_FOLDER, repoViewMock: {} });
    const provisionedBadge = screen.getByTestId('icon-exchange-alt');
    await user.hover(provisionedBadge);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Managed by: Repository');
  });

  it('renders orphaned badge when repository status is orphaned and query is settled', async () => {
    const user = userEvent.setup();
    setup({
      folder: MOCK_FOLDER,
      repoViewMock: { status: RepoViewStatus.Orphaned },
    });

    const orphanedBadge = screen.getByTestId('icon-exclamation-triangle');
    expect(orphanedBadge).toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();

    await user.hover(orphanedBadge);
    expect(await screen.findByText('Repository not found')).toBeInTheDocument();
  });

  it('does not render orphaned badge while repository query is loading', () => {
    setup({
      folder: MOCK_FOLDER,
      repoViewMock: { status: RepoViewStatus.Loading },
    });
    expect(screen.queryByTestId('icon-exclamation-triangle')).not.toBeInTheDocument();
  });
});
