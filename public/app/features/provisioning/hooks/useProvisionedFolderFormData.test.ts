import { act, renderHook, waitFor } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type RepositoryViewData, RepoViewStatus } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { useProvisionedFolderFormData } from './useProvisionedFolderFormData';

// The hook reads a feature flag via OpenFeature, so it must render inside the provider wrapper.
function renderFolderFormData(view: Partial<RepositoryViewData> = {}, title?: string) {
  return renderHook(() => useProvisionedFolderFormData({ view: repositoryViewData(view), title }), {
    wrapper: getWrapper({}),
  });
}

const repoView = (overrides: Partial<RepositoryView> = {}): RepositoryView => ({
  name: 'my-repo',
  title: 'My Repo',
  type: 'github',
  target: 'folder',
  workflows: ['branch', 'write'],
  ...overrides,
});

function repositoryViewData(overrides: Partial<RepositoryViewData>): RepositoryViewData {
  return {
    status: RepoViewStatus.Ready,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    ...overrides,
  };
}

describe('useProvisionedFolderFormData', () => {
  describe('isMissingRepo passthrough', () => {
    it('is false while the repository view is loading', () => {
      const { result } = renderFolderFormData({ isLoading: true, isMissingRepo: false });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isMissingRepo).toBe(false);
    });

    it('is true when no repository could be resolved', () => {
      const { result } = renderFolderFormData({ isMissingRepo: true });

      expect(result.current.isMissingRepo).toBe(true);
      expect(result.current.initialValues).toBeUndefined();
    });

    it('is false when a repository is resolved', () => {
      const { result } = renderFolderFormData({ repository: repoView(), isMissingRepo: false }, 'My folder');

      expect(result.current.isMissingRepo).toBe(false);
      expect(result.current.initialValues).toBeDefined();
    });

    it('is false when the repository is read-only', () => {
      const { result } = renderFolderFormData({
        repository: repoView({ workflows: [] }),
        isReadOnlyRepo: true,
        isMissingRepo: false,
      });

      expect(result.current.isReadOnlyRepo).toBe(true);
      expect(result.current.isMissingRepo).toBe(false);
    });
  });

  describe('initialValues', () => {
    it('is undefined while loading, even if a repository is already cached', () => {
      const { result } = renderFolderFormData({ repository: repoView(), isLoading: true });

      expect(result.current.initialValues).toBeUndefined();
    });

    it('commits at the repository root when the view has no folder', () => {
      const { result } = renderFolderFormData({ repository: repoView({ target: 'folderless' }) }, 'My Team');

      expect(result.current.initialValues).toMatchObject({ repo: 'my-repo', path: '' });
    });

    it('is populated from the repository once loaded', () => {
      const { result } = renderFolderFormData({ repository: repoView() }, 'My folder');

      expect(result.current.initialValues).toMatchObject({
        title: 'My folder',
        repo: 'my-repo',
        workflow: 'branch',
      });
    });
  });

  it('coerces isLoading to a boolean when the view leaves it undefined', () => {
    const { result } = renderFolderFormData({ isLoading: undefined });

    expect(result.current.isLoading).toBe(false);
  });

  describe('enforced branch name template', () => {
    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('switches to the branch workflow when the template is enforced and the flag is on', async () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      // write-first repo: without the override the default workflow would be `write`.
      const { result } = renderFolderFormData(
        {
          repository: repoView({
            workflows: ['write', 'branch'],
            branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
          }),
        },
        'My folder'
      );

      await waitFor(() => expect(result.current.initialValues?.workflow).toBe('branch'));
    });

    it('keeps the default write workflow when enforcement has no usable template', async () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      const { result } = renderFolderFormData(
        {
          repository: repoView({ workflows: ['write', 'branch'], branchOptions: { enforceTemplate: true } }),
        },
        'My folder'
      );

      // enforceTemplate without a nameTemplate: useBranchTemplate stays inactive, so no switch.
      await waitFor(() => expect(result.current.initialValues?.workflow).toBe('write'));
    });
  });
});
