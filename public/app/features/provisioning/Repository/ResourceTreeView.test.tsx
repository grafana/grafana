import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { render, screen } from 'test/test-utils';

import {
  type Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { ResourceTreeView } from './ResourceTreeView';

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryFilesQuery: jest.fn(),
  useGetRepositoryResourcesQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesQuery = jest.mocked(useGetRepositoryFilesQuery);
const mockUseGetRepositoryResourcesQuery = jest.mocked(useGetRepositoryResourcesQuery);
const mockUseBooleanFlagValue = jest.mocked(useBooleanFlagValue);

const repo: Repository = {
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test Repository',
    type: 'github',
    github: { url: 'https://github.com/org/repo', branch: 'main' },
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
};

const files = [
  { path: 'synced.json', hash: 'aaa' },
  { path: 'pending.json', hash: 'bbb' },
];

const resources = [
  { path: 'synced.json', hash: 'aaa', name: 'synced-dash', title: 'Synced Dashboard', resource: 'dashboards', group: 'dashboard.grafana.app' },
  { path: 'pending.json', hash: 'zzz', name: 'pending-dash', title: 'Pending Dashboard', resource: 'dashboards', group: 'dashboard.grafana.app' },
];

function setQueryData() {
  // The component only reads `data.items` and `isLoading`; the rest of the RTK query
  // result is not used, so a partial mock is enough here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryFilesQuery.mockReturnValue({ data: { items: files }, isLoading: false } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetRepositoryResourcesQuery.mockReturnValue({ data: { items: resources }, isLoading: false } as any);
}

describe('ResourceTreeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBooleanFlagValue.mockReturnValue(false);
    setQueryData();
  });

  it('should show all resources by default', () => {
    render(<ResourceTreeView repo={repo} />);

    expect(screen.getByText('Synced Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pending Dashboard')).toBeInTheDocument();
  });

  // The Combobox list is virtualized in jsdom (only the active row renders), so options are
  // selected by keyboard: opening leaves no option active, the first ArrowDown lands on index 0.
  it('should filter to only resources that are not in sync', async () => {
    const { user } = render(<ResourceTreeView repo={repo} />);

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}'); // index 1: Not in sync

    expect(screen.getByText('Pending Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Synced Dashboard')).not.toBeInTheDocument();
  });

  it('should filter to only synced resources', async () => {
    const { user } = render(<ResourceTreeView repo={repo} />);

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{Enter}'); // index 0: Synced

    expect(screen.getByText('Synced Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Pending Dashboard')).not.toBeInTheDocument();
  });

  it('should expose the Warnings filter when the folder metadata flag is on', async () => {
    mockUseBooleanFlagValue.mockReturnValue(true);
    const { user } = render(<ResourceTreeView repo={repo} />);

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}'); // index 2: Warnings

    // None of the sample resources are missing metadata, so filtering by Warnings hides them all.
    expect(screen.queryByText('Synced Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Dashboard')).not.toBeInTheDocument();
  });
});
