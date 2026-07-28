import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export function useIsProvisionedNG(dashboard: DashboardScene): boolean {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folderUid') || undefined;

  const { repository, isInstanceManaged } = useGetResourceRepositoryView({ folderName });

  return dashboard.isManagedRepository() || Boolean(repository) || isInstanceManaged;
}
