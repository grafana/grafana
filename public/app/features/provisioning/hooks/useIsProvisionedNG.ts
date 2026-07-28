import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export function useIsProvisionedNG(dashboard: DashboardScene): boolean {
  const params = new URLSearchParams(window.location.search);
  const isNewDashboard = !dashboard.state.meta.k8s?.name;
  const folderName = isNewDashboard ? params.get('folderUid') || undefined : undefined;

  const { repository, isInstanceManaged } = useGetResourceRepositoryView({
    folderName,
    includeFolderless: !folderName && isNewDashboard,
  });

  return dashboard.isManagedRepository() || Boolean(repository) || isInstanceManaged;
}
