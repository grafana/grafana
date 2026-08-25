import { act, renderHook } from '@testing-library/react';

import { config, locationService } from '@grafana/runtime';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

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
}: { managed?: boolean; k8sName?: string; uid?: string; folderUid?: string } = {}) {
  const state = { uid, meta: { folderUid, k8s: k8sName ? { name: k8sName } : undefined } };
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

  it('returns true when the dashboard is already a managed repository', () => {
    const { result } = renderHook(() => useIsProvisionedNG(createDashboard({ managed: true })));

    expect(result.current).toEqual({ isProvisioned: true, isLoading: false });
  });

  it('does not report loading for a dashboard that is already managed', () => {
    mockRepositoryView({ isLoading: true });

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
      folderName: undefined,
      includeFolderless: true,
    });
  });

  it('does not ask for a folderless repo when the dashboard already exists', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ k8sName: 'existing-dashboard-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: undefined,
      includeFolderless: false,
    });
  });

  it('ignores a stale URL folderUid on an existing dashboard', () => {
    locationService.push('/?folderUid=some-folder');

    renderHook(() => useIsProvisionedNG(createDashboard({ k8sName: 'existing-dashboard-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: undefined,
      includeFolderless: false,
    });
  });

  it('resolves the folder picked in the save form, not the one the URL was entered with', () => {
    locationService.push('/?folderUid=entry-folder');

    renderHook(() => useIsProvisionedNG(createDashboard({ folderUid: 'picked-folder' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: 'picked-folder',
      includeFolderless: false,
    });
  });

  it('does not ask for a folderless repo for a stored dashboard without k8s metadata', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ uid: 'existing-uid' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: undefined,
      includeFolderless: false,
    });
  });

  it('asks for a folderless repo when copying an existing dashboard', () => {
    // The Git save form clears the source's manager annotations when the copy is targeted at the
    // root, so the copy can only keep resolving through the folderless lookup
    renderHook(() => useIsProvisionedNG(createDashboard({ uid: 'existing-uid', k8sName: 'existing-uid' }), true));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: undefined,
      includeFolderless: true,
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
      folderName: 'picked-folder',
      includeFolderless: false,
    });
  });

  it('re-resolves the repository when the folder changes, without the caller subscribing', () => {
    const dashboard = new DashboardScene({ title: 'New dashboard', meta: { folderUid: 'first-folder' } });

    renderHook(() => useIsProvisionedNG(dashboard));

    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      folderName: 'first-folder',
      includeFolderless: false,
    });

    act(() => {
      dashboard.setState({ meta: { folderUid: 'second-folder' } });
    });

    expect(mockUseGetResourceRepositoryView).toHaveBeenLastCalledWith({
      folderName: 'second-folder',
      includeFolderless: false,
    });
  });

  it('treats an empty folderUid as no folder', () => {
    renderHook(() => useIsProvisionedNG(createDashboard({ folderUid: '' })));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: undefined,
      includeFolderless: true,
    });
  });
});
