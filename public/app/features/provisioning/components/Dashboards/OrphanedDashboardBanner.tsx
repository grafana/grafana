import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus, useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

import { OrphanedResourceBanner } from '../Shared/OrphanedResourceBanner';

interface Props {
  dashboard: DashboardScene;
}

export function OrphanedDashboardBanner({ dashboard }: Props) {
  const kind = dashboard.getManagerKind();
  const id = dashboard.getManagerIdentity();
  const uid = dashboard.state.uid ?? '';

  const shouldSkip = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !id;

  const { status } = useGetResourceRepositoryView({
    name: shouldSkip ? undefined : id,
    skipQuery: shouldSkip,
  });

  if (status !== RepoViewStatus.Orphaned) {
    return null;
  }

  return <OrphanedResourceBanner uid={uid} resourceType="dashboards" />;
}
