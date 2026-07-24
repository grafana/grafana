import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';
import { useIsProvisionedNG } from './useIsProvisionedNG';

jest.mock('./useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);

function createDashboard({ managed = false, k8sName }: { managed?: boolean; k8sName?: string } = {}) {
  return {
    isManagedRepository: jest.fn().mockReturnValue(managed),
    state: { meta: { k8s: k8sName ? { name: k8sName } : undefined } },
  } as unknown as DashboardScene;
}

describe('useIsProvisionedNG', () => {
  const originalToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { ...originalToggles, provisioning: true };
    window.history.replaceState({}, '', '/');
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: undefined,
      isInstanceManaged: false,
    } as unknown as ReturnType<typeof useGetResourceRepositoryView>);
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
  });

  it('returns false when provisioning is disabled', () => {
    config.featureToggles = { ...originalToggles, provisioning: false };

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard()));

    expect(result.current).toBe(false);
  });

  it('returns true when the dashboard is already a managed repository', () => {
    const { result } = renderHook(() => useIsProvisionedNG(createDashboard({ managed: true })));

    expect(result.current).toBe(true);
  });

  it('returns true when a repository resolves for the folder', () => {
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: { name: 'my-repo' },
      isInstanceManaged: false,
    } as unknown as ReturnType<typeof useGetResourceRepositoryView>);

    const { result } = renderHook(() => useIsProvisionedNG(createDashboard()));

    expect(result.current).toBe(true);
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

  it('does not ask for a folderless repo when a folder is already selected', () => {
    window.history.replaceState({}, '', '/?folderUid=some-folder');

    renderHook(() => useIsProvisionedNG(createDashboard()));

    expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({
      folderName: 'some-folder',
      includeFolderless: false,
    });
  });
});
