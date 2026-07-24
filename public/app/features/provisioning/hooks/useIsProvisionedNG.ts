import { config } from '@grafana/runtime';

import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export function useIsProvisionedNG(dashboard: DashboardScene): boolean {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folderUid') || undefined;
  const isNewDashboard = !dashboard.state.meta.k8s?.name;

  const { repository, isInstanceManaged } = useGetResourceRepositoryView({
    folderName,
    includeFolderless: !folderName && isNewDashboard,
  });

  if (!config.featureToggles.provisioning) {
    return false;
  }
  return dashboard.isManagedRepository() || Boolean(repository) || isInstanceManaged;
}
