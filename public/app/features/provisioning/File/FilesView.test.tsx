import { render, screen, waitFor } from 'test/test-utils';

import { Repository, useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { FilesView } from './FilesView';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesQuery = jest.mocked(useGetRepositoryFilesQuery);
type RepositoryFilesQueryResult = ReturnType<typeof useGetRepositoryFilesQuery>;

const baseQueryResult = (): RepositoryFilesQueryResult =>
  ({
    currentData: undefined,
    data: { items: [] },
    endpointName: 'getRepositoryFiles',
    error: undefined,
    fulfilledTimeStamp: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    originalArgs: { name: '' },
    refetch: jest.fn(),
    requestId: 'test-request',
    startedTimeStamp: 0,
    status: 'uninitialized',
    subscriptionOptions: undefined,
    unsubscribe: jest.fn(),
  }) satisfies RepositoryFilesQueryResult;

const mockRepositoryFilesQuery = (overrides: Partial<RepositoryFilesQueryResult> = {}) => {
  mockUseGetRepositoryFilesQuery.mockReturnValue({
    ...baseQueryResult(),
    ...overrides,
  });
};

const defaultRepository: Repository = {
  metadata: { name: 'test-repo' },
  spec: {
    title: 'Test repository',
    type: 'github',
    workflows: ['write'],
    sync: { enabled: true, target: 'folder' },
    github: { branch: 'main' },
  },
};

const localRepository: Repository = {
  metadata: { name: 'local-repo' },
  spec: {
    title: 'Local repository',
    type: 'local',
    workflows: [],
    sync: { enabled: true, target: 'folder' },
    local: {},
  },
};

const renderComponent = (repo: Repository = defaultRepository) => {
  return render(<FilesView repo={repo} />);
};

describe('FilesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders spinner while loading', () => {
    mockRepositoryFilesQuery({ isLoading: true, status: 'pending', data: undefined });

    renderComponent();

    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  it('renders file rows with view and history links when data is available', () => {
    mockRepositoryFilesQuery({
      isSuccess: true,
      status: 'fulfilled',
      data: {
        items: [{ path: 'dashboards/example.json', hash: 'abc', size: '10' }],
      },
    });

    renderComponent();

    const viewLink = screen.getByRole('link', { name: 'View' });
    expect(viewLink).toHaveAttribute('href', '/admin/provisioning/test-repo/file/dashboards/example.json');

    const historyLink = screen.getByRole('link', { name: 'History' });
    expect(historyLink).toHaveAttribute(
      'href',
      '/admin/provisioning/test-repo/history/dashboards/example.json?repo_type=github'
    );
  });

  it('filters files using search input', async () => {
    const mockItems = [
      { path: 'dashboards/example.json', hash: 'abc', size: '10' },
      { path: 'dashboards/other.yaml', hash: 'def', size: '20' },
    ];

    mockRepositoryFilesQuery({
      isSuccess: true,
      status: 'fulfilled',
      data: {
        items: mockItems,
      },
    });

    const { user } = renderComponent();

    expect(screen.getAllByRole('row')).toHaveLength(
      // +1 for the header row
      mockItems.length + 1
    );

    const input = screen.getByPlaceholderText('Search');
    await user.clear(input);
    await user.type(input, 'other');

    await waitFor(() =>
      expect(screen.getAllByRole('row')).toHaveLength(
        // +1 for the header row
        2
      )
    );
    expect(screen.getByText('dashboards/other.yaml')).toBeInTheDocument();
  });

  it('hides history link when repository type is not supported', () => {
    mockRepositoryFilesQuery({
      isSuccess: true,
      status: 'fulfilled',
      data: {
        items: [{ path: 'dashboards/example.json', hash: 'abc', size: '10' }],
      },
    });

    renderComponent(localRepository);

    expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
  });

  it('renders plain text and hides actions for .keep files', () => {
    mockRepositoryFilesQuery({
      isSuccess: true,
      status: 'fulfilled',
      data: {
        items: [{ path: 'dashboards/.keep', hash: 'abc', size: '0' }],
      },
    });

    renderComponent();

    expect(screen.getByText('dashboards/.keep')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'dashboards/.keep' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
  });
});
