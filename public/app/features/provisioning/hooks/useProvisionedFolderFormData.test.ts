import { renderHook } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { useProvisionedFolderFormData } from './useProvisionedFolderFormData';

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);

const repoView = (overrides: Partial<RepositoryView> = {}): RepositoryView => ({
  name: 'my-repo',
  title: 'My Repo',
  type: 'github',
  target: 'folder',
  workflows: ['branch', 'write'],
  ...overrides,
});

function setupRepoView(overrides: Partial<ReturnType<typeof useGetResourceRepositoryView>> = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    ...overrides,
  } as ReturnType<typeof useGetResourceRepositoryView>);
}

describe('useProvisionedFolderFormData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isMissingRepo passthrough', () => {
    it('is false while the repository view is loading', () => {
      setupRepoView({ isLoading: true, isMissingRepo: false });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1' }));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isMissingRepo).toBe(false);
    });

    it('is true when no repository could be resolved', () => {
      setupRepoView({ isMissingRepo: true });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1' }));

      expect(result.current.isMissingRepo).toBe(true);
      expect(result.current.initialValues).toBeUndefined();
    });

    it('is false when a repository is resolved', () => {
      setupRepoView({ repository: repoView(), isMissingRepo: false });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1', title: 'My folder' }));

      expect(result.current.isMissingRepo).toBe(false);
      expect(result.current.initialValues).toBeDefined();
    });

    it('is false when the repository is read-only', () => {
      setupRepoView({ repository: repoView({ workflows: [] }), isReadOnlyRepo: true, isMissingRepo: false });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1' }));

      expect(result.current.isReadOnlyRepo).toBe(true);
      expect(result.current.isMissingRepo).toBe(false);
    });
  });

  describe('initialValues', () => {
    it('is undefined while loading, even if a repository is already cached', () => {
      setupRepoView({ repository: repoView(), isLoading: true });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1' }));

      expect(result.current.initialValues).toBeUndefined();
    });

    it('is populated from the repository once loaded', () => {
      setupRepoView({ repository: repoView() });

      const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1', title: 'My folder' }));

      expect(result.current.initialValues).toMatchObject({
        title: 'My folder',
        repo: 'my-repo',
        workflow: 'branch',
      });
    });
  });

  it('coerces isLoading to a boolean when the upstream hook returns undefined', () => {
    setupRepoView({ isLoading: undefined });

    const { result } = renderHook(() => useProvisionedFolderFormData({ folderUid: 'folder-1' }));

    expect(result.current.isLoading).toBe(false);
  });
});
