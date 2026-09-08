import { act, renderHook } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useDashboardRepositoryView } from './useDashboardRepositoryView';
import { RepoViewStatus, type RepositoryViewData, useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('./useGetResourceRepositoryView', () => ({
  ...jest.requireActual('./useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);

type RepositoryViewOverrides = Partial<Omit<RepositoryViewData, 'repository'>> & {
  repository?: Partial<RepositoryView>;
};

function mockRepositoryView(overrides: RepositoryViewOverrides = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: undefined,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
    status: RepoViewStatus.Ready,
    ...overrides,
  } as RepositoryViewData);
}

function createDashboard({
  managed = false,
  k8sName,
  uid,
  folderUid,
  managerName,
}: { managed?: boolean; k8sName?: string; uid?: string; folderUid?: string; managerName?: string } = {}) {
  const annotations = managerName
    ? { [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: managerName }
    : undefined;
  const k8s = k8sName || annotations ? { name: k8sName, annotations } : undefined;
  const state = { uid, meta: { folderUid, k8s } };
  return {
    isManagedRepository: jest.fn().mockReturnValue(managed),
    state,
    useState: () => state,
  } as unknown as DashboardScene;
}

describe('useDashboardRepositoryView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepositoryView();
  });

  it('settles a stored managed dashboard from its own annotation without waiting on the lookup', () => {
    mockRepositoryView({ status: RepoViewStatus.Loading });

    const { result } = renderHook(() =>
      useDashboardRepositoryView(createDashboard({ managed: true, uid: 'd1', k8sName: 'd1', managerName: 'repo-a' }))
    );

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: 'repo-a',
      folderName: undefined,
      includeFolderless: false,
    });
    expect(result.current).toMatchObject({
      isNewSave: false,
      isProvisioned: true,
      status: RepoViewStatus.Loading,
      isHeld: false,
    });
  });

  it('does not look up a folder or a folderless repository for a stored unmanaged dashboard', () => {
    const { result } = renderHook(() =>
      useDashboardRepositoryView(createDashboard({ uid: 'd1', k8sName: 'd1', folderUid: 'f1' }))
    );

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: false,
    });
    expect(result.current).toMatchObject({ isNewSave: false, isProvisioned: false });
  });

  it('resolves a new dashboard at the root through the folderless lookup and follows it', () => {
    const dashboard = createDashboard();
    const { result, rerender } = renderHook(() => useDashboardRepositoryView(dashboard));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: true,
    });
    expect(result.current).toMatchObject({ isNewSave: true, isProvisioned: false, status: RepoViewStatus.Ready });

    mockRepositoryView({ repository: { name: 'root-repo', target: 'folderless' } });
    rerender();
    expect(result.current).toMatchObject({ isProvisioned: true, status: RepoViewStatus.Ready });
    expect(result.current.repository?.name).toBe('root-repo');
  });

  it('resolves a new dashboard from the folder it is headed to', () => {
    const { result } = renderHook(() => useDashboardRepositoryView(createDashboard({ folderUid: 'f1' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: 'f1',
      includeFolderless: false,
    });
    expect(result.current.folderUid).toBe('f1');
  });

  it('resolves a Save As copy like a new save, from its annotation and folder rather than isManagedRepository', () => {
    const { result } = renderHook(() =>
      useDashboardRepositoryView(
        createDashboard({ managed: true, uid: 'd1', k8sName: 'd1', managerName: 'repo-a', folderUid: 'f0' }),
        true
      )
    );

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: 'repo-a',
      folderName: 'f0',
      includeFolderless: false,
    });
    expect(result.current).toMatchObject({ isNewSave: true, isProvisioned: false });
  });

  it('resolves a previewed file from the repository named by its annotation', () => {
    renderHook(() => useDashboardRepositoryView(createDashboard({ managerName: 'repo-a' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: 'repo-a',
      folderName: undefined,
      includeFolderless: true,
    });
  });

  it('does not count an instance repository for a new save whose lookup dead-ended', () => {
    mockRepositoryView({ status: RepoViewStatus.Orphaned, orphanedRepoName: 'ghost', isInstanceManaged: true });

    const { result } = renderHook(() => useDashboardRepositoryView(createDashboard()));

    expect(result.current).toMatchObject({ isNewSave: true, isProvisioned: false, status: RepoViewStatus.Orphaned });
    expect(result.current.isHeld).toBe(false);
  });

  it('re-resolves when the dashboard meta changes, without the caller re-rendering', () => {
    const dashboard = new DashboardScene({ title: 'New dashboard', meta: { folderUid: 'f1' } });

    renderHook(() => useDashboardRepositoryView(dashboard));
    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      name: undefined,
      folderName: 'f1',
      includeFolderless: false,
    });

    act(() => {
      dashboard.setState({ meta: { folderUid: 'f2' } });
    });

    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      name: undefined,
      folderName: 'f2',
      includeFolderless: false,
    });
  });

  describe('holding the settled view', () => {
    const newDashboard = () => new DashboardScene({ title: 'New dashboard', meta: { folderUid: undefined } });

    it('reports the first lookup as loading with nothing held', () => {
      mockRepositoryView({ status: RepoViewStatus.Loading });

      const { result } = renderHook(() => useDashboardRepositoryView(newDashboard()));

      expect(result.current).toMatchObject({ status: RepoViewStatus.Loading, folderUid: undefined, isHeld: false });
      expect(result.current.lookup).toEqual({ status: RepoViewStatus.Loading, error: undefined });
    });

    it('holds the root view while a picked folder loads, then adopts the result', () => {
      const dashboard = newDashboard();
      mockRepositoryView({ repository: { name: 'root-repo', target: 'folderless' } });
      const { result, rerender } = renderHook(() => useDashboardRepositoryView(dashboard));

      expect(result.current).toMatchObject({ isProvisioned: true, folderUid: undefined, isHeld: false });

      mockRepositoryView({ status: RepoViewStatus.Loading });
      act(() => {
        dashboard.setState({ meta: { folderUid: 'f1' } });
      });

      expect(result.current).toMatchObject({ status: RepoViewStatus.Ready, isHeld: true });
      expect(result.current.repository?.name).toBe('root-repo');
      expect(result.current.folderUid).toBeUndefined();
      expect(result.current.lookup).toEqual({ status: RepoViewStatus.Loading, error: undefined });

      mockRepositoryView();
      rerender();

      expect(result.current).toMatchObject({ isProvisioned: false, folderUid: 'f1', isHeld: false });
      expect(result.current.repository).toBeUndefined();
    });

    it('holds a new save through a dead end and reports it until a later pick resolves', () => {
      const dashboard = newDashboard();
      mockRepositoryView({ repository: { name: 'root-repo', target: 'folderless' } });
      const { result, rerender } = renderHook(() => useDashboardRepositoryView(dashboard));

      mockRepositoryView({ status: RepoViewStatus.Orphaned, orphanedRepoName: 'ghost' });
      act(() => {
        dashboard.setState({ meta: { folderUid: 'f2' } });
      });

      expect(result.current.repository?.name).toBe('root-repo');
      expect(result.current.folderUid).toBeUndefined();
      expect(result.current.isHeld).toBe(true);
      expect(result.current.lookup.status).toBe(RepoViewStatus.Orphaned);

      const error = new Error('boom');
      mockRepositoryView({ status: RepoViewStatus.Error, error });
      rerender();

      expect(result.current.repository?.name).toBe('root-repo');
      expect(result.current.lookup).toEqual({ status: RepoViewStatus.Error, error });

      mockRepositoryView({ repository: { name: 'root-repo', target: 'folderless' } });
      act(() => {
        dashboard.setState({ meta: { folderUid: undefined } });
      });

      expect(result.current.isHeld).toBe(false);
    });

    it('adopts a dead end for a stored dashboard', () => {
      mockRepositoryView({ repository: { name: 'repo-a' } });
      const { result, rerender } = renderHook(() =>
        useDashboardRepositoryView(createDashboard({ managed: true, uid: 'd1', k8sName: 'd1', managerName: 'repo-a' }))
      );

      expect(result.current.repository?.name).toBe('repo-a');

      mockRepositoryView({ status: RepoViewStatus.Orphaned, orphanedRepoName: 'repo-a' });
      rerender();

      expect(result.current.status).toBe(RepoViewStatus.Orphaned);
      expect(result.current.isHeld).toBe(false);
    });
  });
});
