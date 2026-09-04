import { act, renderHook } from '@testing-library/react';

import { config, locationService } from '@grafana/runtime';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';
import { useIsProvisionedNG } from './useIsProvisionedNG';

jest.mock('./useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);

type RepositoryViewOverrides = Partial<Omit<ReturnType<typeof useGetResourceRepositoryView>, 'repository'>> & {
  repository?: Partial<RepositoryView>;
};

function mockRepositoryView(overrides: RepositoryViewOverrides = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: undefined,
    isInstanceManaged: false,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useGetResourceRepositoryView>);
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

describe('useIsProvisionedNG', () => {
  const originalProvisioningEnabled = config.provisioningEnabled;

  beforeEach(() => {
    jest.clearAllMocks();
    config.provisioningEnabled = true;
    locationService.push('/');
    mockRepositoryView();
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
  });

  it('returns false when provisioning is disabled, even for a managed dashboard with a resolved repository', () => {
    config.provisioningEnabled = false;
    mockRepositoryView({ repository: { name: 'my-repo' }, isInstanceManaged: true });

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard({ managed: true })));

    expect(result.current).toEqual({ isProvisioned: false, isLoading: false });
  });

  it('returns true when the stored dashboard is already a managed repository', () => {
    const { result } = renderHook(() =>
      useIsProvisionedNG(createDashboard({ managed: true, k8sName: 'existing-uid' }))
    );

    expect(result.current).toEqual({ isProvisioned: true, isLoading: false });
  });

  it('does not report loading for a stored dashboard that is already managed', () => {
    mockRepositoryView({ isLoading: true });

    const { result } = renderHook(() =>
      useIsProvisionedNG(createDashboard({ managed: true, k8sName: 'existing-uid' }))
    );

    expect(result.current).toEqual({ isProvisioned: true, isLoading: false });
  });

  it('does not claim a new save is provisioned off an annotation the lookup cannot resolve', () => {
    // The form's own lookup would report this repo orphaned, so answering "provisioned" from the
    // annotation alone is what left the drawer rendering a provisioned branch around that dead end
    const { result } = renderHook(() => useIsProvisionedNG(createDashboard({ managed: true })));

    expect(result.current).toEqual({ isProvisioned: false, isLoading: false });
  });

  it('resolves a new save annotation as a hint so the form and this hook agree', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ managed: true, managerName: 'deleted-repo' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: 'deleted-repo',
      folderName: undefined,
      includeFolderless: true,
      nameIsHint: true,
    });
  });

  it('keeps a stored dashboard annotation authoritative, so a missing repository still reports orphaned', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ k8sName: 'existing-uid', managerName: 'deleted-repo' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: false,
      nameIsHint: false,
    });
  });

  it('still reports a new save as provisioned when its annotation resolves to a repository', () => {
    mockRepositoryView({ repository: { name: 'my-repo' } });

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard({ managed: true })));

    expect(result.current).toEqual({ isProvisioned: true, isLoading: false });
  });

  it('returns true when a repository resolves for the folder', () => {
    mockRepositoryView({ repository: { name: 'my-repo' } });

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard()));

    expect(result.current).toEqual({ isProvisioned: true, isLoading: false });
  });

  it('reports loading while the repository lookup is in flight', () => {
    mockRepositoryView({ isLoading: true });

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard()));

    // Callers must hold their form until this settles, or an unprovisioned form flashes first
    expect(result.current).toEqual({ isProvisioned: false, isLoading: true });
  });

  it('asks for a folderless repo when saving a brand-new dashboard at root', () => {
    renderHook(() => useIsProvisionedNG(createDashboard()));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: true,
      nameIsHint: true,
    });
  });

  it('does not ask for a folderless repo when the dashboard already exists', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ k8sName: 'existing-dashboard-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: false,
      nameIsHint: false,
    });
  });

  it('ignores a stale URL folderUid on an existing dashboard', () => {
    locationService.push('/?folderUid=some-folder');

    renderHook(() => useIsProvisionedNG(createDashboard({ k8sName: 'existing-dashboard-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: false,
      nameIsHint: false,
    });
  });

  it('resolves the folder picked in the save form, not the one the URL was entered with', () => {
    locationService.push('/?folderUid=entry-folder');

    renderHook(() => useIsProvisionedNG(createDashboard({ folderUid: 'picked-folder' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: 'picked-folder',
      includeFolderless: false,
      nameIsHint: true,
    });
  });

  it('does not ask for a folderless repo for a stored dashboard without k8s metadata', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ uid: 'existing-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: false,
      nameIsHint: false,
    });
  });

  it('asks for a folderless repo when copying an existing dashboard', () => {
    // The Git save form clears the source's manager annotations when the copy is targeted at the
    // root, so the copy can only keep resolving through the folderless lookup
    renderHook(() => useIsProvisionedNG(createDashboard({ uid: 'existing-uid', k8sName: 'existing-uid' }), true));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: true,
      nameIsHint: true,
    });
  });

  it('resolves the folder picked in the save form when copying an existing dashboard to a folder', () => {
    renderHook(() =>
      useIsProvisionedNG(
        createDashboard({ uid: 'existing-uid', k8sName: 'existing-uid', folderUid: 'picked-folder' }),
        true
      )
    );

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: 'picked-folder',
      includeFolderless: false,
      nameIsHint: true,
    });
  });

  it('re-resolves the repository when the folder changes, without the caller subscribing', () => {
    const dashboard = new DashboardScene({ title: 'New dashboard', meta: { folderUid: 'first-folder' } });

    renderHook(() => useIsProvisionedNG(dashboard));

    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      name: undefined,
      folderName: 'first-folder',
      includeFolderless: false,
      nameIsHint: true,
    });

    act(() => {
      dashboard.setState({ meta: { folderUid: 'second-folder' } });
    });

    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      name: undefined,
      folderName: 'second-folder',
      includeFolderless: false,
      nameIsHint: true,
    });
  });

  it('treats an empty folderUid as no folder', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ folderUid: '' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      name: undefined,
      folderName: undefined,
      includeFolderless: true,
      nameIsHint: true,
    });
  });
});
