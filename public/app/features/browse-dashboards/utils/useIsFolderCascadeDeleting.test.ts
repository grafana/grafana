import { renderHook } from 'test/test-utils';

import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useIsFolderCascadeDeleting } from './useIsFolderCascadeDeleting';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;

function mockQueryResult(data?: Folder): ReturnType<typeof useGetFolderQuery> {
  return {
    data,
    currentData: data,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isSuccess: Boolean(data),
    isError: false,
    isUninitialized: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useGetFolderQuery>;
}

describe('useIsFolderCascadeDeleting', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the folder has no deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({ metadata: { name: 'folder-1' }, spec: { title: 'My folder' } } as Folder)
    );

    const { result } = renderHook(() => useIsFolderCascadeDeleting('folder-1'));

    expect(result.current).toBe(false);
  });

  it('returns true when the folder has a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(
      mockQueryResult({
        metadata: { name: 'folder-1', deletionTimestamp: '2024-01-01T00:00:00Z' },
        spec: { title: 'My folder' },
      } as Folder)
    );

    const { result } = renderHook(() => useIsFolderCascadeDeleting('folder-1'));

    expect(result.current).toBe(true);
  });

  it('returns false without querying when there is no folder UID', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult(undefined));

    const { result } = renderHook(() => useIsFolderCascadeDeleting(undefined));

    expect(result.current).toBe(false);
  });
});
