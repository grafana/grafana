import { Scope, ScopeDashboardBinding } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { group, namespace, version } from './common';

const endpoint = `/apis/${group}/${version}/namespaces/${namespace}/find/scope_dashboard_bindings`;

export async function fetchDashboards(scopes: Scope[]): Promise<ScopeDashboardBinding[]> {
  try {
    const response = await getBackendSrv().get<{ items: ScopeDashboardBinding[] }>(endpoint, {
      scope: scopes.map(({ metadata: { name } }) => name),
    });

    return response?.items ?? [];
  } catch (err) {
    return [];
  }
}
