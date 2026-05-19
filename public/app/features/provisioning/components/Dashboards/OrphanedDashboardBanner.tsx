import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus, useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { OrphanedResourceBanner } from '../Shared/OrphanedResourceBanner';

interface Props {
  dashboard: DashboardScene;
}

/**
 * Adapter between DashboardScene and OrphanedResourceBanner.
 * Reads the dashboard's provisioning manager identity, checks whether its
 * repository still exists, and renders the banner only when the resource is orphaned.
 */
export function OrphanedDashboardBanner({ dashboard }: Props) {
  const kind = dashboard.getManagerKind();
  const name = dashboard.getManagerIdentity();

  const shouldSkip = !config.featureToggles.provisioning || kind !== ManagerKind.Repo || !name;

  const { status } = useGetResourceRepositoryView({
    name: shouldSkip ? undefined : name,
    skipQuery: shouldSkip,
  });

  if (status !== RepoViewStatus.Orphaned) {
    return null;
  }

  return <OrphanedResourceBanner repositoryName={name!} />;
}
