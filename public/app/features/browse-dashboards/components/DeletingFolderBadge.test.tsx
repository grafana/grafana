import { render, screen } from 'test/test-utils';

import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { DeletingFolderBadge } from './DeletingFolderBadge';

// `refetchChildren` is a real thunk that hits the search service, which isn't set up in this
// unit test's environment. Keep its `.fulfilled` action matcher (slice.ts's extraReducers
// registers a case reducer against it at module load, real store and all) but replace what
// dispatching it actually does with a no-op, so the effect that calls it on unmount/404 doesn't
// crash the test.
jest.mock('../state/actions', () => {
  const actual = jest.requireActual('../state/actions');
  return {
    ...actual,
    refetchChildren: Object.assign(
      jest.fn(() => ({ type: 'test/refetchChildren/noop' })),
      {
        fulfilled: actual.refetchChildren.fulfilled,
        pending: actual.refetchChildren.pending,
        rejected: actual.refetchChildren.rejected,
        typePrefix: actual.refetchChildren.typePrefix,
      }
    ),
  };
});

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;

function makeFolder(overrides: Partial<Folder['metadata']> = {}, remaining?: number): Folder {
  return {
    metadata: { name: 'folder-1', deletionTimestamp: '2024-01-01T00:00:00Z', ...overrides },
    spec: { title: 'My folder' },
    status: remaining !== undefined ? { cascadeDelete: { state: 'working', remaining } } : undefined,
  } as Folder;
}

// The real hook's return type includes several RTK Query bookkeeping fields (refetch,
// isFetching, isUninitialized, ...) this test doesn't care about; only `data`/`error` drive
// DeletingFolderBadge's behaviour, so this fills in harmless defaults for the rest.
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

describe('DeletingFolderBadge', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Deleting badge while the folder still has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ data: makeFolder() }));

    render(<DeletingFolderBadge folderUID="folder-1" />);

    expect(screen.getByText('Deleting')).toBeInTheDocument();
  });

  it('surfaces the remaining child count in the badge text', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ data: makeFolder({}, 7) }));

    render(<DeletingFolderBadge folderUID="folder-1" />);

    expect(screen.getByText('Deleting (7 left)')).toBeInTheDocument();
  });

  it('renders nothing once the folder is confirmed gone (404)', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ error: { status: 404, data: {} } }));

    render(<DeletingFolderBadge folderUID="folder-1" />);

    expect(screen.queryByText('Deleting')).not.toBeInTheDocument();
  });

  it('renders nothing if the folder no longer has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult({ data: makeFolder({ deletionTimestamp: undefined }) }));

    render(<DeletingFolderBadge folderUID="folder-1" />);

    expect(screen.queryByText('Deleting')).not.toBeInTheDocument();
  });
});
