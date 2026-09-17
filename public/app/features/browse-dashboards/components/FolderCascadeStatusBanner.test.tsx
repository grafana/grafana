import { render, screen } from 'test/test-utils';

import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useOfferFolderMove } from '../utils/useOfferFolderMove';

import { FolderCascadeStatusBanner } from './FolderCascadeStatusBanner';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

jest.mock('../utils/useOfferFolderMove', () => ({
  useOfferFolderMove: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;
const mockUseOfferFolderMove = useOfferFolderMove as jest.MockedFunction<typeof useOfferFolderMove>;

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

describe('FolderCascadeStatusBanner', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the remaining count while the cascade is still working', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 3 } }) })
    );
    mockUseOfferFolderMove.mockReturnValue(jest.fn());

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/3 items left/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows a generic in-progress message once nothing is left to report', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'working', remaining: 0 } }) })
    );
    mockUseOfferFolderMove.mockReturnValue(jest.fn());

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/deleting its contents in the background/i)).toBeInTheDocument();
  });

  it('renders nothing once the folder no longer has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({
        data: makeFolder(
          { deletionTimestamp: undefined },
          { cascadeDelete: { state: 'error', errors: ['boom'], remaining: 0 } }
        ),
      })
    );
    mockUseOfferFolderMove.mockReturnValue(jest.fn());

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the reported errors when the cascade is stuck', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({
        data: makeFolder({}, { cascadeDelete: { state: 'error', errors: ['dashboard X is locked'], remaining: 0 } }),
      })
    );
    mockUseOfferFolderMove.mockReturnValue(jest.fn());

    render(<FolderCascadeStatusBanner folderUID="folder-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('dashboard X is locked')).toBeInTheDocument();
  });

  it('offers to move the folder elsewhere', async () => {
    const offerFolderMove = jest.fn();
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ data: makeFolder({}, { cascadeDelete: { state: 'error', errors: ['boom'], remaining: 0 } }) })
    );
    mockUseOfferFolderMove.mockReturnValue(offerFolderMove);

    const { user } = render(<FolderCascadeStatusBanner folderUID="folder-1" />);
    await user.click(screen.getByRole('button', { name: /move this folder instead/i }));

    expect(offerFolderMove).toHaveBeenCalledWith('folder-1');
  });
});
