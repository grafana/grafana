import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { type Folder, useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { RepoViewStatus, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('app/api/clients/folder/v1beta1', () => ({
  useGetFolderQuery: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

const mockUseGetFolderQuery = jest.mocked(useGetFolderQuery);
const mockUseGetFrontendSettingsQuery = jest.mocked(useGetFrontendSettingsQuery);

const repoView = (overrides: Partial<RepositoryView> = {}): RepositoryView => ({
  name: 'my-repo',
  title: 'My Repo',
  type: 'github',
  target: 'folder',
  workflows: ['branch', 'write'],
  ...overrides,
});

const folderData = (annotations: Record<string, string> = {}): Folder =>
  ({
    metadata: { name: 'nested-folder', namespace: 'default', annotations },
    spec: { title: 'Nested Folder' },
  }) as Folder;

function setupMocks({
  settingsItems = [] as RepositoryView[],
  settingsLoading = false,
  settingsError,
  folder,
  folderLoading = false,
  folderError,
}: {
  settingsItems?: RepositoryView[];
  settingsLoading?: boolean;
  settingsError?: unknown;
  folder?: Folder;
  folderLoading?: boolean;
  folderError?: unknown;
} = {}) {
  mockUseGetFrontendSettingsQuery.mockReturnValue({
    data: { items: settingsItems },
    isLoading: settingsLoading,
    error: settingsError,
    refetch: jest.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof useGetFrontendSettingsQuery>);

  mockUseGetFolderQuery.mockReturnValue({
    data: folder,
    isLoading: folderLoading,
    error: folderError,
    refetch: jest.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof useGetFolderQuery>);
}

describe('useGetResourceRepositoryView', () => {
  const originalToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { ...originalToggles, provisioning: true };
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
  });

  describe('provisioning disabled', () => {
    it('returns Disabled status', () => {
      config.featureToggles = { ...originalToggles, provisioning: false };
      setupMocks();

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Disabled);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('loading states', () => {
    it('returns Loading when settings are loading', () => {
      setupMocks({ settingsLoading: true });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Loading);
      expect(result.current.isLoading).toBe(true);
    });

    it('returns Loading when folder is loading', () => {
      setupMocks({ folderLoading: true });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Loading);
    });
  });

  describe('error states', () => {
    it('returns Error when settings query fails', () => {
      const err = { status: 500, data: { message: 'boom' } };
      setupMocks({ settingsError: err });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Error);
      expect(result.current.error).toBe(err);
    });

    it('returns Error when folder query fails', () => {
      const err = { status: 404, data: { message: 'not found' } };
      setupMocks({ folderError: err });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Error);
      expect(result.current.error).toBe(err);
    });
  });

  describe('name-based lookup', () => {
    it('returns Ready with matching repository', () => {
      const repo = repoView();
      setupMocks({ settingsItems: [repo] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ name: 'my-repo' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.repository).toBe(repo);
    });

    it('returns Orphaned when name does not match any repository', () => {
      setupMocks({ settingsItems: [repoView()] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ name: 'deleted-repo' }));

      expect(result.current.status).toBe(RepoViewStatus.Orphaned);
      expect(result.current.orphanedRepoName).toBe('deleted-repo');
    });

    it('sets isInstanceManaged when an instance repo exists', () => {
      const instanceRepo = repoView({ name: 'instance-repo', target: 'instance' });
      setupMocks({ settingsItems: [instanceRepo] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ name: 'missing-repo' }));

      expect(result.current.isInstanceManaged).toBe(true);
    });
  });

  describe('folder-based lookup', () => {
    it('returns Ready when folderName directly matches a repo name (root folder)', () => {
      const repo = repoView();
      setupMocks({ settingsItems: [repo] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'my-repo' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.repository).toBe(repo);
    });

    it('returns Ready when nested folder has repo-managed annotation matching an existing repo', () => {
      const repo = repoView();
      const folder = folderData({
        [AnnoKeyManagerKind]: ManagerKind.Repo,
        [AnnoKeyManagerIdentity]: 'my-repo',
      });
      setupMocks({ settingsItems: [repo], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'nested-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.repository).toBe(repo);
    });

    it('returns Orphaned when nested folder has repo-managed annotation but repo no longer exists', () => {
      const folder = folderData({
        [AnnoKeyManagerKind]: ManagerKind.Repo,
        [AnnoKeyManagerIdentity]: 'deleted-repo',
      });
      setupMocks({ settingsItems: [repoView()], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'nested-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Orphaned);
      expect(result.current.orphanedRepoName).toBe('deleted-repo');
    });
  });

  describe('non-repo managed folders', () => {
    it('does NOT return Orphaned for a folder managed by classic-file-provisioning', () => {
      const instanceRepo = repoView({ name: 'instance-repo', target: 'instance' });
      const folder = folderData({
        [AnnoKeyManagerKind]: 'classic-file-provisioning',
        [AnnoKeyManagerIdentity]: 'dashboard-grafanacloud-usage',
      });
      setupMocks({ settingsItems: [instanceRepo], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'grafanacloud-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.orphanedRepoName).toBeUndefined();
      expect(result.current.repository).toBe(instanceRepo);
    });

    it('does NOT return Orphaned for a folder managed by a plugin', () => {
      const folder = folderData({
        [AnnoKeyManagerKind]: ManagerKind.Plugin,
        [AnnoKeyManagerIdentity]: 'some-plugin-id',
      });
      setupMocks({ settingsItems: [repoView()], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'plugin-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.orphanedRepoName).toBeUndefined();
    });

    it('does NOT return Orphaned for a folder managed by terraform', () => {
      const folder = folderData({
        [AnnoKeyManagerKind]: ManagerKind.Terraform,
        [AnnoKeyManagerIdentity]: 'tf-managed',
      });
      setupMocks({ settingsItems: [repoView()], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'tf-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.orphanedRepoName).toBeUndefined();
    });

    it('does NOT return Orphaned for a folder managed by kubectl', () => {
      const folder = folderData({
        [AnnoKeyManagerKind]: ManagerKind.Kubectl,
        [AnnoKeyManagerIdentity]: 'kubectl-managed',
      });
      setupMocks({ settingsItems: [repoView()], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'kubectl-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.orphanedRepoName).toBeUndefined();
    });

    it('does NOT return Orphaned for a folder with managerId but no managedBy annotation', () => {
      const folder = folderData({
        [AnnoKeyManagerIdentity]: 'some-identity',
      });
      setupMocks({ settingsItems: [repoView()], folder });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'untyped-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.orphanedRepoName).toBeUndefined();
    });
  });

  describe('default fallback', () => {
    it('returns instance repo when no specific folder match', () => {
      const instanceRepo = repoView({ name: 'instance-repo', target: 'instance' });
      setupMocks({ settingsItems: [instanceRepo] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'unmanaged-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.repository).toBe(instanceRepo);
      expect(result.current.isInstanceManaged).toBe(true);
    });

    it('returns Ready with no repository when items list is empty', () => {
      setupMocks({ settingsItems: [] });

      const { result } = renderHook(() => useGetResourceRepositoryView({ folderName: 'some-folder' }));

      expect(result.current.status).toBe(RepoViewStatus.Ready);
      expect(result.current.repository).toBeUndefined();
      expect(result.current.isInstanceManaged).toBe(false);
    });
  });
});
