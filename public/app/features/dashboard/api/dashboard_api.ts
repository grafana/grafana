import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { DashboardDTO } from 'app/types/dashboard';

import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { LegacyDashboardAPI } from './legacy';
import { DashboardAPI, DashboardWithAccessInfo } from './types';
import { getDashboardsApiVersion } from './utils';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';

type DashboardAPIClients = {
  legacy: DashboardAPI<DashboardDTO, Dashboard>;
  v1: DashboardAPI<DashboardDTO, Dashboard>;
  v2: DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, DashboardV2Spec>;
  unified: DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec>;
};

let clients: Partial<DashboardAPIClients> | undefined;

export function setDashboardAPI(override: Partial<DashboardAPIClients> | undefined) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('dashboardAPI can be only overridden in test environment');
  }
  clients = override;
}

// Overloads
export function getDashboardAPI(): DashboardAPI<
  DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>,
  Dashboard | DashboardV2Spec
>;
export function getDashboardAPI(responseFormat: 'v1'): DashboardAPI<DashboardDTO, Dashboard>;
export function getDashboardAPI(
  responseFormat: 'v2'
): DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>, DashboardV2Spec>;
export function getDashboardAPI(
  responseFormat?: 'v1' | 'v2'
): DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec> {
  const v = getDashboardsApiVersion(responseFormat);

  if (!clients) {
    clients = {
      legacy: new LegacyDashboardAPI(),
      v1: new K8sDashboardAPI(),
      v2: new K8sDashboardV2API(),
      unified: new UnifiedDashboardAPI(),
    };
  }

  if (!clients[v]) {
    throw new Error(`Unknown Dashboard API version: ${v}`);
  }

  return clients[v];
}
