import { act, renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardRepositoryView } from './useDashboardRepositoryView';
import { RepoViewStatus } from './useGetResourceRepositoryView';
import { getDefaultValues, useProvisionedDashboardData } from './useProvisionedDashboardData';

const folderRepo: RepositoryView = {
  name: 'my-repo',
  title: 'My Repo',
  type: 'github',
  target: 'folder',
  branch: 'main',
  workflows: ['branch', 'write'],
};

const folderlessRepo: RepositoryView = {
  name: 'folderless-repo',
  title: 'Folderless Repo',
  type: 'github',
  target: 'folderless',
  workflows: ['branch', 'write'],
};

function folder(sourcePath: string): Folder {
  return {
    kind: 'Folder',
    apiVersion: 'folder.grafana.app/v1beta1',
    metadata: {
      name: 'test-folder',
      namespace: 'default',
      uid: 'test-folder',
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: { [AnnoKeySourcePath]: sourcePath },
    },
    spec: { title: 'Test Folder', description: '' },
  };
}

function readyView(repository?: RepositoryView, folderData?: Folder): DashboardRepositoryView {
  return {
    status: RepoViewStatus.Ready,
    repository,
    folder: folderData,
    isHeld: false,
    lookup: { status: RepoViewStatus.Ready },
    isNewSave: false,
    isProvisioned: Boolean(repository),
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: !repository,
  };
}

function pendingView(status: RepoViewStatus, error?: unknown): DashboardRepositoryView {
  return {
    status,
    error,
    isHeld: false,
    lookup: { status, error },
    isNewSave: false,
    isProvisioned: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: status !== RepoViewStatus.Loading,
  };
}

const storedMeta: DashboardMeta = {
  folderUid: 'test-folder',
  k8s: {
    name: 'stored-dash',
    annotations: {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeyManagerIdentity]: 'my-repo',
      [AnnoKeySourcePath]: 'dashboards/test.json',
    },
  },
};

const timestamp = '2023-01-01-abcde';

describe('getDefaultValues', () => {
  it('returns Loading with null values while the repository is being resolved', () => {
    const result = getDefaultValues({
      meta: storedMeta,
      defaultTitle: 'Test Dashboard',
      isNew: false,
      view: pendingView(RepoViewStatus.Loading),
      timestamp,
    });

    expect(result.status).toBe(RepoViewStatus.Loading);
    expect(result.values).toBeNull();
  });

  it('returns Error with the lookup error', () => {
    const error = new Error('Forbidden');
    const result = getDefaultValues({
      meta: storedMeta,
      defaultTitle: 'Test Dashboard',
      isNew: false,
      view: pendingView(RepoViewStatus.Error, error),
      timestamp,
    });

    expect(result.status).toBe(RepoViewStatus.Error);
    expect(result.values).toBeNull();
    expect(result.error).toBe(error);
  });

  it('returns Orphaned with null values and no error', () => {
    const result = getDefaultValues({
      meta: storedMeta,
      defaultTitle: 'Test Dashboard',
      isNew: false,
      view: pendingView(RepoViewStatus.Orphaned),
      timestamp,
    });

    expect(result.status).toBe(RepoViewStatus.Orphaned);
    expect(result.values).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('returns Error when the view is Ready without a repository', () => {
    const result = getDefaultValues({
      meta: storedMeta,
      defaultTitle: 'Test Dashboard',
      isNew: false,
      view: readyView(),
      timestamp,
    });

    expect(result.status).toBe(RepoViewStatus.Error);
    expect(result.values).toBeNull();
  });

  it('returns Ready with form values for a stored dashboard, keeping its annotated repo and path', () => {
    const result = getDefaultValues({
      meta: storedMeta,
      defaultTitle: 'Test Dashboard',
      isNew: false,
      view: readyView(folderRepo, folder('dashboards')),
      timestamp,
    });

    expect(result.status).toBe(RepoViewStatus.Ready);
    expect(result.values).toMatchObject({
      repo: 'my-repo',
      title: 'Test Dashboard',
      path: 'dashboards/test.json',
      folder: { uid: 'test-folder' },
    });
    expect(result.repository?.name).toBe('my-repo');
    expect(result.isNew).toBe(false);
  });

  it('targets the resolved repository, not a stale annotation, for a new save', () => {
    const meta: DashboardMeta = {
      folderUid: 'test-folder',
      k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: 'deleted-repo' } },
    };

    const result = getDefaultValues({
      meta,
      defaultTitle: 'New Dashboard',
      isNew: true,
      view: readyView(folderRepo),
      timestamp,
    });

    expect(result.values?.repo).toBe('my-repo');
    expect(result.isNew).toBe(true);
  });

  it('names a new save file after its title inside the resolved folder', () => {
    const result = getDefaultValues({
      meta: { folderUid: 'test-folder' },
      defaultTitle: 'New Dashboard',
      isNew: true,
      view: readyView(folderlessRepo, folder('team-a')),
      timestamp,
    });

    expect(result.values?.path).toBe('team-a/new-dashboard.json');
  });

  it('names a copy after the given title and ignores the source file path', () => {
    const meta: DashboardMeta = {
      slug: 'existing-dashboard',
      k8s: {
        name: 'existing-dashboard-uid',
        resourceVersion: '42',
        annotations: { [AnnoKeySourcePath]: 'My Team/existing-dashboard.json' },
      },
    };

    const result = getDefaultValues({
      meta,
      defaultTitle: 'Existing Dashboard Copy',
      saveAsCopy: true,
      isNew: true,
      view: readyView(folderlessRepo),
      timestamp,
    });

    expect(result.values).toMatchObject({
      title: 'Existing Dashboard Copy',
      path: 'existing-dashboard-copy.json',
      repo: 'folderless-repo',
      copyTags: false,
    });
  });

  it('drops the folder path prefix when a picked folder is cleared back to the repository root', () => {
    const inFolder = getDefaultValues({
      meta: { folderUid: 'f1' },
      defaultTitle: 'New Dashboard',
      isNew: true,
      view: readyView(folderlessRepo, folder('team-b')),
      timestamp,
    });

    expect(inFolder.values?.path).toBe('team-b/new-dashboard.json');

    const atRoot = getDefaultValues({
      meta: { folderUid: '' },
      defaultTitle: 'New Dashboard',
      isNew: true,
      view: readyView(folderlessRepo),
      timestamp,
    });

    expect(atRoot.status).toBe(RepoViewStatus.Ready);
    expect(atRoot.values?.repo).toBe('folderless-repo');
    expect(atRoot.values?.path).toBe('new-dashboard.json');
  });
});

describe('useProvisionedDashboardData', () => {
  function createDashboard(meta: Partial<DashboardMeta> = {}) {
    return new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      description: 'A test dashboard',
      meta: { slug: 'test-dashboard', ...storedMeta, ...meta },
    });
  }

  const wrapper = getWrapper({ renderWithRouter: true });

  it('propagates Loading status with null defaultValues', () => {
    const { result } = renderHook(
      () => useProvisionedDashboardData(createDashboard(), pendingView(RepoViewStatus.Loading)),
      { wrapper }
    );

    expect(result.current.repoDataStatus).toBe(RepoViewStatus.Loading);
    expect(result.current.defaultValues).toBeNull();
    expect(result.current.readOnly).toBe(true);
  });

  it('propagates Error status with the error object', () => {
    const error = new Error('Forbidden');
    const { result } = renderHook(
      () => useProvisionedDashboardData(createDashboard(), pendingView(RepoViewStatus.Error, error)),
      { wrapper }
    );

    expect(result.current.repoDataStatus).toBe(RepoViewStatus.Error);
    expect(result.current.defaultValues).toBeNull();
    expect(result.current.error).toBe(error);
  });

  it('returns Ready with populated defaultValues when resolved', () => {
    const { result } = renderHook(
      () => useProvisionedDashboardData(createDashboard(), readyView(folderRepo, folder('dashboards'))),
      { wrapper }
    );

    expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready);
    expect(result.current.defaultValues).toMatchObject({
      repo: 'my-repo',
      title: 'Test Dashboard',
      description: 'A test dashboard',
    });
    expect(result.current.repository?.name).toBe('my-repo');
    expect(result.current.readOnly).toBe(false);
  });

  it('keeps the same defaultValues object across re-renders whose inputs did not change', () => {
    const dashboard = createDashboard();
    const folderData = folder('dashboards');
    // The view wrapper is rebuilt per render, as the hook that produces it does; its fields are stable
    const { result, rerender } = renderHook(
      () => useProvisionedDashboardData(dashboard, readyView(folderRepo, folderData)),
      { wrapper }
    );
    const first = result.current.defaultValues;
    expect(first).not.toBeNull();

    rerender();

    expect(result.current.defaultValues).toBe(first);
  });

  it('seeds a new save from the title and description handed over by the previous form, filename included', () => {
    const view = { ...readyView(folderlessRepo), isNewSave: true };
    const { result } = renderHook(
      () =>
        useProvisionedDashboardData(createDashboard({ folderUid: undefined, k8s: undefined }), view, {
          title: 'Typed',
          description: 'Typed desc',
        }),
      { wrapper }
    );

    expect(result.current.isNew).toBe(true);
    expect(result.current.defaultValues).toMatchObject({
      title: 'Typed',
      description: 'Typed desc',
      path: 'typed.json',
    });
  });

  it('suffixes a copy once: the title parked by the form is final on re-resolution', () => {
    const view = { ...readyView(folderlessRepo), isNewSave: true };
    const { result, rerender } = renderHook(
      ({ title }: { title?: string }) =>
        useProvisionedDashboardData(createDashboard({ folderUid: undefined, k8s: undefined }), view, {
          saveAsCopy: true,
          title,
        }),
      { wrapper, initialProps: {} as { title?: string } }
    );

    expect(result.current.defaultValues).toMatchObject({
      title: 'Test Dashboard Copy',
      path: 'test-dashboard-copy.json',
    });

    // The form parks exactly what it shows; a folder pick recomputes the defaults from that
    rerender({ title: 'Test Dashboard Copy' });

    expect(result.current.defaultValues).toMatchObject({
      title: 'Test Dashboard Copy',
      path: 'test-dashboard-copy.json',
    });
  });

  it('keeps one filename timestamp across recomputes when there is no title to slugify', () => {
    const dashboard = createDashboard({ folderUid: undefined, k8s: undefined, slug: undefined });
    dashboard.setState({ title: '' });
    const view = { ...readyView(folderlessRepo), isNewSave: true };
    const { result, rerender } = renderHook(() => useProvisionedDashboardData(dashboard, view), { wrapper });

    const path = result.current.defaultValues?.path;
    expect(path).toMatch(/^new-dashboard-.+\.json$/);

    rerender();

    expect(result.current.defaultValues?.path).toBe(path);
  });

  describe('enforced branch name template', () => {
    // write-first repo: without the enforced-template override the default workflow would be `write`.
    const enforcedRepo: RepositoryView = {
      ...folderRepo,
      workflows: ['write', 'branch'],
      branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
    };

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('switches to the branch workflow when the template is enforced and the flag is on', () => {
      setTestFlags({ 'provisioning.gitConventions': true });

      const { result } = renderHook(
        () => useProvisionedDashboardData(createDashboard(), readyView(enforcedRepo, folder('dashboards'))),
        { wrapper }
      );

      // The workflow is switched here; useBranchTemplate fills the actual template ref in the form.
      expect(result.current.defaultValues?.workflow).toBe('branch');
      // The ref follows the workflow: a branch default must never point at the configured branch.
      expect(result.current.defaultValues?.ref).toMatch(/^dashboard\//);
    });

    it('keeps the same defaultValues object across rerenders when the override applies', () => {
      setTestFlags({ 'provisioning.gitConventions': true });

      const dashboard = createDashboard();
      const folderData = folder('dashboards');
      const { result, rerender } = renderHook(
        () => useProvisionedDashboardData(dashboard, readyView(enforcedRepo, folderData)),
        { wrapper }
      );

      const initial = result.current.defaultValues;
      expect(initial?.workflow).toBe('branch');

      // The form resets to defaultValues whenever its identity changes, so a fresh object per render
      // would reset the form on every unrelated rerender.
      rerender();
      expect(result.current.defaultValues).toBe(initial);
    });

    it('keeps the default write workflow when the gitConventions flag is off', () => {
      setTestFlags({ 'provisioning.gitConventions': false });

      const { result } = renderHook(
        () => useProvisionedDashboardData(createDashboard(), readyView(enforcedRepo, folder('dashboards'))),
        { wrapper }
      );

      expect(result.current.defaultValues?.workflow).toBe('write');
    });

    it('keeps the default write workflow when enforcement has no usable template', () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      // enforceTemplate set without a nameTemplate: useBranchTemplate stays inactive, so the
      // workflow must not switch (nothing to enforce).
      const repo: RepositoryView = { ...enforcedRepo, branchOptions: { enforceTemplate: true } };

      const { result } = renderHook(
        () => useProvisionedDashboardData(createDashboard(), readyView(repo, folder('dashboards'))),
        { wrapper }
      );

      expect(result.current.defaultValues?.workflow).toBe('write');
    });
  });

  describe('generated branch name', () => {
    // A rerender (e.g. from toggling a save option) must not regenerate the branch name: the form
    // resets to the defaults with keepDirtyValues, so a new name would replace the pristine field.
    it.each([
      { desc: 'the default branch workflow', recoverToNewBranch: undefined },
      { desc: 'the deleted-branch recovery', recoverToNewBranch: { fileExistsOnConfiguredBranch: true } },
    ])('stays stable across rerenders for $desc', ({ recoverToNewBranch }) => {
      const dashboard = createDashboard();
      const folderData = folder('dashboards');
      const { result, rerender } = renderHook(
        () => useProvisionedDashboardData(dashboard, readyView(folderRepo, folderData), { recoverToNewBranch }),
        { wrapper }
      );

      const initialRef = result.current.defaultValues?.ref;
      expect(result.current.defaultValues?.workflow).toBe('branch');
      expect(initialRef).toMatch(/^dashboard\//);

      rerender();
      expect(result.current.defaultValues?.ref).toBe(initialRef);
    });
  });

  describe('recoverToNewBranch', () => {
    it('defaults to a fresh branch even when the preview was loaded from a non-default ref', () => {
      // Loaded from an explicit ref the defaults would otherwise pick the write workflow at that ref.
      const dashboard = createDashboard();
      const { result } = renderHook(
        () =>
          useProvisionedDashboardData(dashboard, readyView(folderRepo, folder('dashboards')), {
            recoverToNewBranch: { fileExistsOnConfiguredBranch: true },
          }),
        {
          wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: ['/?ref=feature-branch'] } }),
        }
      );

      expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready);
      expect(result.current.defaultValues?.workflow).toBe('branch');
      expect(result.current.defaultValues?.ref).toMatch(/^dashboard\//);
      expect(result.current.defaultValues?.ref).not.toBe('feature-branch');
    });
  });
});
