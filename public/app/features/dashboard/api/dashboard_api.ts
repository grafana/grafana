import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDTO } from 'app/types';

import { LegacyDashboardAPI } from './legacy';
import { DashboardAPI, DashboardWithAccessInfo } from './types';
import { getDashboardsApiVersion } from './utils';
import { K8sDashboardAPI } from './v0';
import { K8sDashboardV2API } from './v2';

type DashboardAPIClients = {
  legacy: DashboardAPI<DashboardDTO>;
  v0: DashboardAPI<DashboardDTO>;
  // v1: DashboardDTO; TODO[schema]: enable v1 when available
  v2: DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>>;
};

type DashboardReturnTypes = DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>;

let clients: Partial<DashboardAPIClients> | undefined;

export function setDashboardAPI(override: Partial<DashboardAPIClients> | undefined) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('dashboardAPI can be only overridden in test environment');
  }
  clients = override;
}

// Overloads
export function getDashboardAPI(): DashboardAPI<DashboardDTO>;
export function getDashboardAPI(requestV2Response: 'v2'): DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>>;
export function getDashboardAPI(requestV2Response?: 'v2'): DashboardAPI<DashboardReturnTypes> {
  const v = getDashboardsApiVersion();
  const isConvertingToV1 = !requestV2Response;

  if (!clients) {
    clients = {
      legacy: new LegacyDashboardAPI(),
      v0: new K8sDashboardAPI(),
      v2: new K8sDashboardV2API(isConvertingToV1),
    };
  }

  if (v === 'v2' && requestV2Response === 'v2') {
    return new K8sDashboardV2API(false);
  }

  if (!clients[v]) {
    throw new Error(`Unknown Dashboard API version: ${v}`);
  }

  return clients[v];
}
