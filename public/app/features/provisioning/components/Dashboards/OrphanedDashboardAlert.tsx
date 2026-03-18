import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { OrphanedResourceBanner } from '../Shared/OrphanedResourceBanner';

interface Props {
  dashboard: DashboardScene;
}

export function OrphanedDashboardAlert({ dashboard }: Props) {
  const uid = dashboard.state.uid ?? '';
  return <OrphanedResourceBanner uid={uid} resourceType="dashboards" variant="alert" />;
}
