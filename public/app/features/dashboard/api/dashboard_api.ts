import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardDTO } from 'app/types/dashboard';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { LegacyDashboardAPI } from './legacy';
import { type DashboardAPI, type DashboardWithAccessInfo } from './types';
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
export async function getDashboardAPI(): Promise<
  DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec>
>;
export async function getDashboardAPI(responseFormat: 'v1'): Promise<DashboardAPI<DashboardDTO, Dashboard>>;
export async function getDashboardAPI(
  responseFormat: 'v2'
): Promise<DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>, DashboardV2Spec>>;
export async function getDashboardAPI(
  responseFormat?: 'v1' | 'v2'
): Promise<DashboardAPI<DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>, Dashboard | DashboardV2Spec>> {
  // Ensure API versions are resolved before creating clients.
  // The resolver caches internally — only the first call does a network request.
  // On failure it returns beta fallbacks without caching, so we rebuild
  // clients on next call to avoid locking them to stale beta URLs.
  await dashboardAPIVersionResolver.resolve();

  const v = getDashboardsApiVersion(responseFormat);

  if (!clients || !dashboardAPIVersionResolver.isResolved) {
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
