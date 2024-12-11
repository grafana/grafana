import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { DashboardDTO } from 'app/types';

import { LegacyDashboardAPI } from './legacy';
import { TransitionalDashboardAPI } from './transitional_dashboard_api';
import { DashboardAPI, DashboardWithAccessInfo } from './types';
import { getDashboardsApiVersion } from './utils';
import { K8sDashboardAPI } from './v0';
import { K8sDashboardV2APIStub } from './v2';

type DashboardAPIClients = {
  legacy: DashboardAPI<DashboardDTO>;
  v0: DashboardAPI<DashboardDTO>;
  v2: DashboardAPI<DashboardDTO>;
};

type V2ModeOptions = {
  useV2Mode: true;
};

let clients: Partial<DashboardAPIClients> | undefined;

// Overloads
export function getDashboardAPI(): DashboardAPI<DashboardDTO>;
export function getDashboardAPI(opts: V2ModeOptions): DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>>;

export function getDashboardAPI(opts?: V2ModeOptions): DashboardAPI<any> {
  const v = getDashboardsApiVersion();
  const v2api = new K8sDashboardV2APIStub();

  if (!clients) {
    clients = {
      legacy: new LegacyDashboardAPI(),
      v0: new K8sDashboardAPI(),
      v2: new TransitionalDashboardAPI(v2api),
    };
  }

  if (v === 'v2' && opts?.useV2Mode) {
    return new K8sDashboardV2APIStub();
  }

  if (!clients[v]) {
    throw new Error(`Unknown Dashboard API version: ${v}`);
  }

  return clients[v];
}
