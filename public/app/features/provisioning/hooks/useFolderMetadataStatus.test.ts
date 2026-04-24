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
      expect(result.current.status).toBe('loading');
    });

    it('when file query is loading', () => {
      setupMocks({
        fileQueryOverrides: { isLoading: true },
      });

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current.status).toBe('loading');
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
      expect(result.current.status).toBe('missing');
      expect(result.current.repositoryName).toBe('my-repo');
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
      expect(result.current.status).toBe('error');
    });
  });

  describe('returns ok', () => {
    it('when file exists', () => {
      setupMocks();

      const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
      expect(result.current.status).toBe('ok');
    });
  });

  describe('root folder of folder-targeted repo', () => {
    it('returns ok without querying _folder.json (root identity is stable)', () => {
      setupMocks({
        repoViewOverrides: {
          repository: { name: 'my-repo', target: 'folder', title: 'Repo', type: 'github', workflows: ['branch'] },
        },
        fileQueryOverrides: {
          data: undefined,
          error: undefined,
          isLoading: false,
        },
      });

      // folderUID matches repo name -- this is the root folder
      const { result } = renderHook(() => useFolderMetadataStatus('my-repo'));
      expect(result.current.status).toBe('ok');
      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith(expect.any(Symbol));
    });

    it('still checks metadata for nested folders of folder-targeted repos', () => {
      setupMocks({
        repoViewOverrides: {
          repository: { name: 'my-repo', target: 'folder', title: 'Repo', type: 'github', workflows: ['branch'] },
        },
      });

      // folderUID does NOT match repo name -- this is a nested folder
      renderHook(() => useFolderMetadataStatus('nested-folder-uid'));
      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
    });
  });

  describe('instance-targeted repo', () => {
    it('still checks _folder.json even when folderUID matches repo name', () => {
      setupMocks({
        repoViewOverrides: {
          repository: { name: 'my-repo', target: 'instance', title: 'Repo', type: 'github', workflows: ['branch'] },
        },
      });

      // Same UID as repo name, but target is 'instance' -- root shortcut must not apply
      renderHook(() => useFolderMetadataStatus('my-repo'));
      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
        name: 'my-repo',
        path: 'folders/my-folder/_folder.json',
      });
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
