import { config, locationService } from '@grafana/runtime';

import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export interface ProvisionedNGState {
  isProvisioned: boolean;
  /** Repository resolution is still in flight, so isProvisioned is not yet meaningful */
  isLoading: boolean;
}

export function useIsProvisionedNG(dashboard: DashboardScene): ProvisionedNGState {
  const { folderUid } = locationService.getSearchObject();
  // Both identities must be absent: a stored dashboard resolves its repository from its own
  // annotations, so it must not trigger a folder or folderless lookup
  const isNewDashboard = !dashboard.state.uid && !dashboard.state.meta.k8s?.name;
  // A folderUid left in the URL says nothing about where an existing dashboard lives
  const folderName = isNewDashboard && typeof folderUid === 'string' ? folderUid || undefined : undefined;

  const { repository, isInstanceManaged, isLoading } = useGetResourceRepositoryView({
    folderName,
    includeFolderless: !folderName && isNewDashboard,
  });

  // The toggle wins over everything, even repo-managed annotations on the dashboard itself
  if (!config.featureToggles.provisioning) {
    return { isProvisioned: false, isLoading: false };
  }

  // The dashboard's own annotations settle this without waiting on the repository lookup
  if (dashboard.isManagedRepository()) {
    return { isProvisioned: true, isLoading: false };
  }

  return { isProvisioned: Boolean(repository) || isInstanceManaged, isLoading: Boolean(isLoading) };
}
