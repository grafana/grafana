import { type Spec as DashboardV3alpha0Spec } from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';

import { K8sDashboardSchemaAPI } from './k8sSchemaBase';

const V3_ALPHA0_VERSION = 'v3alpha0';

export function getK8sV3alpha0DashboardApiConfig() {
  return {
    group: 'dashboard.grafana.app',
    version: V3_ALPHA0_VERSION,
    resource: 'dashboards',
  };
}

/**
 * v3alpha0 dashboard client. Adds the rules-related schema on top of v2's
 * layout and panel model. Only reachable when the backend advertises v3alpha0
 * AND the dashboardRules feature toggle is on (see DashboardAPIVersionResolver).
 */
export class K8sDashboardV3alpha0API extends K8sDashboardSchemaAPI<DashboardV3alpha0Spec> {
  constructor() {
    super(getK8sV3alpha0DashboardApiConfig());
  }
}

