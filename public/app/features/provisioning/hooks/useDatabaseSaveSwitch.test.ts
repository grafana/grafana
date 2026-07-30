import { act, renderHook } from '@testing-library/react';

import { locationService } from '@grafana/runtime';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';
import { DashboardSavedEvent } from 'app/types/events';

import { useDatabaseSaveSwitch } from './useDatabaseSaveSwitch';
import { RepoViewStatus } from './useGetResourceRepositoryView';

const folderlessRepo: RepositoryView = {
  name: 'test-repo',
  title: 'Test Repo',
  type: 'github',
  target: 'folderless',
  workflows: ['write'],
};

function createDashboard(meta: DashboardMeta = {}, initialMeta: DashboardMeta = {}) {
  const state = { meta };
  return {
    state,
    getInitialState: () => ({ meta: initialMeta }),
    setState: jest.fn(({ meta }: { meta: DashboardMeta }) => {
      state.meta = meta;
    }),
  } as unknown as DashboardScene;
}

function setup({
  dashboard = createDashboard(),
  repository = folderlessRepo,
  repoDataStatus = RepoViewStatus.Ready,
  isNewDashboard = true,
}: {
  dashboard?: DashboardScene;
  repository?: RepositoryView;
  repoDataStatus?: RepoViewStatus;
  isNewDashboard?: boolean;
} = {}) {
  const rendered = renderHook(() => useDatabaseSaveSwitch({ dashboard, repository, repoDataStatus, isNewDashboard }));
  return { ...rendered, dashboard };
}

describe('useDatabaseSaveSwitch', () => {
  beforeEach(() => {
    locationService.push('/');
  });

  it('offers the switch for a new dashboard on a folderless repo', () => {
    const { result } = setup();

    expect(result.current.canSwitch).toBe(true);
    expect(result.current.saveToDatabase).toBe(false);
  });

  it('does not offer the switch for an existing dashboard', () => {
    const { result } = setup({ isNewDashboard: false });

    expect(result.current.canSwitch).toBe(false);
  });

  it('does not offer the switch for a folder-target repo', () => {
    const { result } = setup({ repository: { ...folderlessRepo, target: 'folder' } });

    expect(result.current.canSwitch).toBe(false);
  });

  it('offers the switch when a new dashboard dead-ends without a repository', () => {
    const { result } = setup({ repository: undefined, repoDataStatus: RepoViewStatus.Orphaned });

    expect(result.current.canSwitch).toBe(true);
  });

  it('clears the provisioned folder and annotations when switching to the database', () => {
    const dashboard = createDashboard({
      folderUid: 'repo-folder',
      k8s: { annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo } },
    });
    const { result } = setup({ dashboard });

    act(() => result.current.switchToDatabase());

    expect(result.current.saveToDatabase).toBe(true);
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined, k8s: undefined } });
  });

  it('keeps the picked folder when the git flow has already dead-ended', () => {
    const dashboard = createDashboard({ folderUid: 'unmanaged-folder' });
    const { result } = setup({ dashboard, repository: undefined, repoDataStatus: RepoViewStatus.Error });

    act(() => result.current.switchToDatabase());

    expect(dashboard.setState).not.toHaveBeenCalled();
  });

  it('restores the git meta on switch-back, and only once', () => {
    const dashboard = createDashboard({ folderUid: 'git-folder' });
    const { result, unmount } = setup({ dashboard });

    act(() => result.current.switchToDatabase());
    act(() => result.current.switchToGit());

    expect(dashboard.setState).toHaveBeenLastCalledWith({ meta: { folderUid: 'git-folder' } });
    expect(result.current.saveToDatabase).toBe(false);

    const callsAfterSwitchBack = jest.mocked(dashboard.setState).mock.calls.length;
    act(() => result.current.switchToGit());
    unmount();

    expect(jest.mocked(dashboard.setState).mock.calls).toHaveLength(callsAfterSwitchBack);
  });

  it('restores the entry folder on switch-back when the repo never resolved', () => {
    locationService.push('/?folderUid=repo-folder');
    const dashboard = createDashboard({ folderUid: 'orphaned-folder' });
    const { result } = setup({ dashboard, repository: undefined, repoDataStatus: RepoViewStatus.Orphaned });

    act(() => result.current.switchToDatabase());
    act(() => result.current.switchToGit());

    expect(dashboard.setState).toHaveBeenLastCalledWith({ meta: { folderUid: 'repo-folder', k8s: undefined } });
  });

  it('resets a new dashboard to its initial meta on unmount', () => {
    const dashboard = createDashboard({ folderUid: 'git-folder' }, {});
    const { result, unmount } = setup({ dashboard });

    act(() => result.current.switchToDatabase());
    unmount();

    expect(dashboard.setState).toHaveBeenLastCalledWith({ meta: {} });
  });

  it('does not touch the meta on unmount after a completed save', () => {
    const dashboard = createDashboard({ folderUid: 'git-folder' });
    const { result, unmount } = setup({ dashboard });

    act(() => result.current.switchToDatabase());
    act(() => appEvents.publish(new DashboardSavedEvent()));
    const callsAfterSave = jest.mocked(dashboard.setState).mock.calls.length;
    unmount();

    expect(jest.mocked(dashboard.setState).mock.calls).toHaveLength(callsAfterSave);
  });

  it('does not touch the meta on unmount from the git flow', () => {
    const dashboard = createDashboard({ folderUid: 'git-folder' });
    const { unmount } = setup({ dashboard });

    unmount();

    expect(dashboard.setState).not.toHaveBeenCalled();
  });
});
