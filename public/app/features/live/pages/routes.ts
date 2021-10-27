import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';
import { isGrafanaAdmin } from 'app/features/plugins/admin/permissions';

const liveRoutes = [
  {
    path: '/live',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "LiveStatusPage" */ 'app/features/live/pages/LiveStatusPage')
    ),
  },
  {
    path: '/live/pipeline',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "PipelineAdminPage" */ 'app/features/live/pages/PipelineAdminPage')
    ),
  },
  {
    path: '/live/cloud',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "CloudAdminPage" */ 'app/features/live/pages/CloudAdminPage')
    ),
  },
];

export function getLiveRoutes(cfg = config): RouteDescriptor[] {
  if (!isGrafanaAdmin()) {
    return [];
  }
  if (cfg.featureToggles['live-pipeline']) {
    return liveRoutes;
  }
  return liveRoutes.map((v) => ({
    ...v,
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "FeatureTogglePage" */ 'app/features/live/pages/FeatureTogglePage')
    ),
  }));
}
