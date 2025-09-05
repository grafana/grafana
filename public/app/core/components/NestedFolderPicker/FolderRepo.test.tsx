import { render, screen, cleanup } from '@testing-library/react';

import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardViewItem } from 'app/features/search/types';

import { FolderRepo } from './FolderRepo';

jest.mock('@grafana/runtime', () => ({
  config: { featureToggles: { provisioning: true } },
}));

const mockUseGetFrontendSettingsQuery = jest.fn();
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: () => mockUseGetFrontendSettingsQuery(),
}));

const mockUseGetResourceRepositoryView = jest.fn();
jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: () => mockUseGetResourceRepositoryView(),
}));

function mockSettings(items: Array<Partial<RepositoryView>>) {
  mockUseGetFrontendSettingsQuery.mockReturnValue({ data: { items } });
}

function mockRepoView({ isReadOnlyRepo = false, repoType = 'github' }) {
  mockUseGetResourceRepositoryView.mockReturnValue({ isReadOnlyRepo, repoType });
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
  repoViewMock?: { isReadOnlyRepo?: boolean; repoType?: string };
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
    expect(screen.queryByTitle('Provisioned')).not.toBeInTheDocument();
  });

  it('returns null when folder has parentUID', () => {
    setup({ folder: { ...MOCK_FOLDER, parentUID: 'repo-123' } });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Provisioned')).not.toBeInTheDocument();
  });

  it('returns null when folder is not managed', () => {
    setup({ folder: { ...MOCK_FOLDER, managedBy: undefined } });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Provisioned')).not.toBeInTheDocument();
  });

  it('returns null when whole instance is provisioned', () => {
    setup({ folder: MOCK_FOLDER, settingsMock: [{ target: 'instance' }] });
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Provisioned')).not.toBeInTheDocument();
  });

  it('renders Read only badge when repo is read-only (empty workflows)', () => {
    setup({ folder: MOCK_FOLDER, repoViewMock: { isReadOnlyRepo: true, repoType: 'github' } });
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByTitle('Provisioned')).toBeInTheDocument();
  });
});
