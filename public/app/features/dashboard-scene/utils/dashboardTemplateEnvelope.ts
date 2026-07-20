import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

export interface TemplateDashboardEnvelopeOpts {
  dashboardSpec: DashboardV2Spec;
  dashboardVersion?: string;
  resourceVersion?: string;
  canEdit?: boolean;
  canSave?: boolean;
}

/**
 * Wraps a v2 dashboard payload (extracted from `DashboardTemplate.spec.dashboard`)
 * into the shape expected by `transformSaveModelSchemaV2ToScene`.
 *
 * Templates don't have folders, stars, sharing, or deletion semantics, so those
 * access flags are hardcoded off.
 */
export function transformTemplateToSaveModelSchemaV2(
  opts: TemplateDashboardEnvelopeOpts
): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    apiVersion: opts.dashboardVersion ?? dashboardAPIVersionResolver.getV2(),
    kind: 'DashboardWithAccessInfo',
    metadata: {
      creationTimestamp: '',
      name: '',
      resourceVersion: opts.resourceVersion ?? '0',
    },
    spec: opts.dashboardSpec,
    access: {
      canSave: opts.canSave ?? false,
      canEdit: opts.canEdit ?? false,
      canStar: false,
      canShare: false,
      canDelete: false,
    },
  };
}
