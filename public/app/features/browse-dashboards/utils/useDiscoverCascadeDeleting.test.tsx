import { skipToken } from '@reduxjs/toolkit/query';
import { render } from 'test/test-utils';

import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';

import { useDiscoverCascadeDeleting } from './useDiscoverCascadeDeleting';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1'),
  useGetFolderQuery: jest.fn(),
}));

const mockUseGetFolderQuery = useGetFolderQuery as jest.MockedFunction<typeof useGetFolderQuery>;

function makeFolder(overrides: Partial<Folder['metadata']> = {}): Folder {
  return { metadata: { name: 'folder-1', ...overrides }, spec: { title: 'My folder' } } as Folder;
}

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

function TestComponent({ folderUID, alreadyTracked }: { folderUID: string; alreadyTracked: boolean }) {
  useDiscoverCascadeDeleting(folderUID, alreadyTracked);
  return null;
}

// `render()` only hands back a `store` reference when a preloadedState is given (otherwise it
// builds one internally and keeps it to itself) -- this is otherwise the default empty state.
const preloadedState = {
  browseDashboards: {
    rootItems: undefined,
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: { $all: false, dashboard: {}, folder: {}, panel: {} },
    cascadeDeletingUIDs: {},
    cascadeDeleteErrors: {},
  },
};

describe('useDiscoverCascadeDeleting', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks a folder as cascade-deleting once discovered to have a deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult(makeFolder({ deletionTimestamp: '2024-01-01T00:00:00Z' })));

    const { store } = render(<TestComponent folderUID="folder-1" alreadyTracked={false} />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeletingUIDs).toEqual({ 'folder-1': true });
  });

  it('does nothing for a folder with no deletionTimestamp', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult(makeFolder()));

    const { store } = render(<TestComponent folderUID="folder-1" alreadyTracked={false} />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeletingUIDs).toEqual({});
  });

  it('skips the query entirely once already tracked', () => {
    mockUseGetFolderQuery.mockReturnValue(mockQueryResult(undefined));

    render(<TestComponent folderUID="folder-1" alreadyTracked />);

    expect(mockUseGetFolderQuery).toHaveBeenCalledWith(skipToken);
  });
});
