import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { convertSpecToWireFormat } from 'app/features/dashboard-scene/serialization/transformationCompat';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import { K8sDashboardSchemaAPI } from './k8sSchemaBase';

export function getK8sV2DashboardApiConfig() {
  return {
    group: 'dashboard.grafana.app',
    version: dashboardAPIVersionResolver.getV2(),
    resource: 'dashboards',
  };
}

/**
 * v2 stable dashboard client. Thin configuration of K8sDashboardSchemaAPI
 * bound to DashboardV2Spec. v2 needs the v2/v2beta1 transformation-kind compat
 * layer on the write path; everything else is shared with v3alpha0.
 */
export class K8sDashboardV2API extends K8sDashboardSchemaAPI<DashboardV2Spec> {
  constructor() {
    super(getK8sV2DashboardApiConfig());
  }

  protected override convertSpecToWireFormat(spec: DashboardV2Spec): DashboardV2Spec {
    return convertSpecToWireFormat(spec);
  }
}
