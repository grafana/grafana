import { act, renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
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
    isLoading: false,
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
  const originalProvisioningEnabled = config.provisioningEnabled;

  beforeEach(() => {
    jest.clearAllMocks();
    config.provisioningEnabled = true;
    mockRepositoryView();
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  it('is never provisioned when provisioning is disabled, whatever the dashboard and lookup say', () => {
    config.provisioningEnabled = false;
    mockRepositoryView({ repository: { name: 'repo-a' }, isInstanceManaged: true, isLoading: true });

    const { result } = renderHook(() =>
      useDashboardRepositoryView(createDashboard({ managed: true, uid: 'd1', k8sName: 'd1', managerName: 'repo-a' }))
    );

    expect(result.current).toMatchObject({ isProvisioned: false, isLoading: false });
  });

  it('settles a stored managed dashboard from its own annotation without waiting on the lookup', () => {
    mockRepositoryView({ isLoading: true, status: RepoViewStatus.Loading });

    const { result } = renderHook(() =>
      useDashboardRepositoryView(createDashboard({ managed: true, uid: 'd1', k8sName: 'd1', managerName: 'repo-a' }))
    );

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: 'repo-a',
      folderName: undefined,
      includeFolderless: false,
    });
    expect(result.current).toMatchObject({ isNewSave: false, isProvisioned: true, isLoading: true });
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
    expect(result.current).toMatchObject({ isNewSave: true, isProvisioned: false, isLoading: false });

    mockRepositoryView({ isLoading: true, status: RepoViewStatus.Loading });
    rerender();
    expect(result.current).toMatchObject({ isProvisioned: false, isLoading: true });

    mockRepositoryView({ repository: { name: 'root-repo', target: 'folderless' } });
    rerender();
    expect(result.current).toMatchObject({ isProvisioned: true, isLoading: false });
    expect(result.current.repository?.name).toBe('root-repo');
  });

  it('resolves a new dashboard from the folder it is headed to', () => {
    renderHook(() => useDashboardRepositoryView(createDashboard({ folderUid: 'f1' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: 'f1',
      includeFolderless: false,
    });
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
});
