import { renderHook } from '@testing-library/react';

import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { useFolderMetadataStatus } from './useFolderMetadataStatus';
import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

jest.mock('./useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);

function setupMocks({
  repoViewOverrides = {},
  fileQueryOverrides = {},
}: {
  repoViewOverrides?: Partial<ReturnType<typeof useGetResourceRepositoryView>>;
  fileQueryOverrides?: Partial<ReturnType<typeof useGetRepositoryFilesWithPathQuery>>;
} = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: { name: 'my-repo', target: 'folder', title: 'Repo', type: 'github', workflows: ['branch'] },
    folder: {
      metadata: {
        annotations: {
          [AnnoKeyManagerKind]: ManagerKind.Repo,
          [AnnoKeySourcePath]: 'folders/my-folder',
        },
      },
      spec: { title: 'My Folder' },
    },
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    ...repoViewOverrides,
  } as ReturnType<typeof useGetResourceRepositoryView>);

  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
    data: { path: 'folders/my-folder/_folder.json' },
    error: undefined,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
    ...fileQueryOverrides,
  } as ReturnType<typeof useGetRepositoryFilesWithPathQuery>);
}

describe('useFolderMetadataStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('returns loading', () => {
    it('when repository view is loading', () => {
      setupMocks({
        repoViewOverrides: { isLoading: true },
      });

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current).toBe('loading');
    });

    it('when file query is fetching', () => {
      setupMocks({
        fileQueryOverrides: { isFetching: true },
      });

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current).toBe('loading');
    });
  });

  describe('returns missing', () => {
    it('when file query returns 404', () => {
      setupMocks({
        fileQueryOverrides: {
          data: undefined,
          error: { status: 404, data: { message: 'not found' } },
        },
      });

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current).toBe('missing');
    });
  });

  describe('returns error', () => {
    it('when file query returns non-404 error', () => {
      setupMocks({
        fileQueryOverrides: {
          data: undefined,
          error: { status: 500, data: { message: 'internal error' } },
        },
      });

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current).toBe('error');
    });
  });

  describe('returns ok', () => {
    it('when file exists', () => {
      setupMocks();

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current).toBe('ok');
    });
  });

  describe('path construction', () => {
    it('queries the correct path for nested folders', () => {
      setupMocks();

      renderHook(() => useFolderMetadataStatus('folder-uid'));

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
    });

    it('queries _folder.json at repo root for root provisioned folders', () => {
      setupMocks({
        repoViewOverrides: {
          folder: {
            metadata: {
              annotations: {
                [AnnoKeyManagerKind]: ManagerKind.Repo,
              },
            },
            spec: { title: 'Root Folder' },
          } as ReturnType<typeof useGetResourceRepositoryView>['folder'],
        },
      });

      renderHook(() => useFolderMetadataStatus('folder-uid'));

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({ name: 'my-repo', path: '_folder.json' });
    });

    it('normalizes trailing slash in source path', () => {
      setupMocks({
        repoViewOverrides: {
          folder: {
            metadata: {
              annotations: {
                [AnnoKeyManagerKind]: ManagerKind.Repo,
                [AnnoKeySourcePath]: 'folders/my-folder/',
              },
            },
            spec: { title: 'Trailing Slash' },
          } as ReturnType<typeof useGetResourceRepositoryView>['folder'],
        },
      });

      renderHook(() => useFolderMetadataStatus('folder-uid'));

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
    });

    it('skips file query when repository name is not yet available', () => {
      setupMocks({
        repoViewOverrides: { repository: undefined },
      });

      renderHook(() => useFolderMetadataStatus('folder-uid'));

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith(expect.any(Symbol));
    });
  });
});
