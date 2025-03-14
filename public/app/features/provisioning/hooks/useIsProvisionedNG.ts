import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';
import { useUrlParams } from 'app/core/navigation/hooks';

import { DashboardScene } from '../../dashboard-scene/scene/DashboardScene';

import { useGetResourceRepository } from './useGetResourceRepository';

export function useIsProvisionedNG(dashboard: DashboardScene): boolean {
  const [params] = useUrlParams();
  const folderUid = params.get('folderUid') || undefined;

  const folderRepository = useGetResourceRepository({ folderUid });
  const { data } = useGetFrontendSettingsQuery();

  return (
    dashboard.isManaged() ||
    Boolean(folderRepository) ||
    Boolean(data?.items.some((item) => item.target === 'instance'))
  );
}
