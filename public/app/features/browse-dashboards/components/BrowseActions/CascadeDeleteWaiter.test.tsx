import { render, screen } from 'test/test-utils';

import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { CascadeDeleteWaiter } from './CascadeDeleteWaiter';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;

function makeFolder(overrides: Partial<Folder['metadata']> = {}, status?: Folder['status']): Folder {
  return {
    metadata: { name: 'folder-1', deletionTimestamp: '2024-01-01T00:00:00Z', ...overrides },
    spec: { title: 'My folder' },
    status,
  } as Folder;
}

// See DeletingFolderBadge.test.tsx: fills in the RTK Query bookkeeping fields this test doesn't care about.
function mockQueryResult(result: { data?: Folder; error?: unknown }): ReturnType<typeof useGetFolderQuery> {
  return {
    data: undefined,
    currentData: undefined,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
    isUninitialized: false,
    refetch: jest.fn(),
    ...result,
  } as unknown as ReturnType<typeof useGetFolderQuery>;
}

describe('CascadeDeleteWaiter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Deleting indicator while the folder still has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ data: makeFolder() }));

    render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={jest.fn()} />);

    expect(screen.getByText('Deleting')).toBeInTheDocument();
  });

  it('reports success once the folder is confirmed gone (404)', () => {
    const onSettled = jest.fn();
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));

    render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={onSettled} />);

    expect(onSettled).toHaveBeenCalledWith('folder-1', 'success');
  });

  it('reports success when the folder never actually started a cascade (no deletionTimestamp)', () => {
    const onSettled = jest.fn();
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({ deletionTimestamp: undefined }) })
    );

    render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={onSettled} />);

    expect(onSettled).toHaveBeenCalledWith('folder-1', 'success');
  });

  it('reports an error, with the reported messages, once the cascade gets stuck', () => {
    const onSettled = jest.fn();
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'error', errors: ['boom'], remaining: 0 } }) })
    );

    render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={onSettled} />);

    expect(onSettled).toHaveBeenCalledWith('folder-1', 'error', ['boom']);
  });

  it('only calls onSettled once even if the settled state keeps being reported', () => {
    const onSettled = jest.fn();
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));

    const { rerender } = render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={onSettled} />);
    rerender(<CascadeDeleteWaiter folderUID="folder-1" onSettled={onSettled} />);

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('renders nothing once no longer deleting', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));

    render(<CascadeDeleteWaiter folderUID="folder-1" onSettled={jest.fn()} />);

    expect(screen.queryByText('Deleting')).not.toBeInTheDocument();
  });
});
