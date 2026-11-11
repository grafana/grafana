import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../scene/DashboardScene';

type EnvelopeMetadata = DashboardWithAccessInfo<DashboardV2Spec>['metadata'];
type EnvelopeAccess = DashboardWithAccessInfo<DashboardV2Spec>['access'];

function resolveMetadata(scene: DashboardScene): EnvelopeMetadata {
  const existing = scene.serializer.getK8SMetadata() ?? {};
  const name = (typeof existing.name === 'string' && existing.name) || scene.state.uid || '';

  return {
    ...existing,
    name,
    generation: existing.generation ?? 1,
    creationTimestamp: existing.creationTimestamp ?? new Date().toISOString(),
    resourceVersion: existing.resourceVersion ?? '0',
  };
}

function resolveAccess(scene: DashboardScene): EnvelopeAccess {
  const meta = scene.state.meta;
  return {
    canEdit: meta.canEdit,
    canSave: meta.canSave,
    canShare: meta.canShare,
    canStar: meta.canStar,
    canDelete: meta.canDelete,
    canAdmin: meta.canAdmin,
    annotationsPermissions: meta.annotationsPermissions,
    isPublic: meta.publicDashboardEnabled,
    slug: meta.slug,
    url: meta.url,
  };
}

export function buildDashboardWithAccessInfoFromScene(
  scene: DashboardScene,
  spec: DashboardV2Spec
): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    kind: 'DashboardWithAccessInfo',
    metadata: resolveMetadata(scene),
    access: resolveAccess(scene),
    apiVersion: `${DASHBOARD_API_GROUP}/${dashboardAPIVersionResolver.getV2()}`,
    spec,
  };
}
