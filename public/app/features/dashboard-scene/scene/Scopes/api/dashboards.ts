import { uniqBy } from 'lodash';

import { Scope, ScopeDashboardBinding, ScopeDashboardBindingSpec } from '@grafana/data';
import { ScopedResourceClient } from 'app/features/apiserver/client';

import { group, version } from './common';

const client = new ScopedResourceClient<ScopeDashboardBindingSpec, 'ScopeDashboardBinding'>({
  group,
  version,
  resource: 'scopedashboardbindings',
});

const cache = new Map<string, Promise<ScopeDashboardBinding[]>>();

async function fetchDashboardsForScope(scope: Scope): Promise<ScopeDashboardBinding[]> {
  const scopeName = scope.metadata.name;

  if (cache.has(scopeName)) {
    return cache.get(scopeName)!;
  }

  const response = new Promise<ScopeDashboardBinding[]>(async (resolve) => {
    try {
      const response = await client.list({
        fieldSelector: [
          {
            key: 'spec.scope',
            operator: '=',
            value: scopeName,
          },
        ],
      });

      resolve(response.items);
    } catch (err) {
      cache.delete(scopeName);

      resolve([]);
    }
  });

  cache.set(scopeName, response);

  return response;
}

export async function fetchDashboards(scopes: Scope[]): Promise<ScopeDashboardBinding[]> {
  const dashboardsPairs = await Promise.all(scopes.map(fetchDashboardsForScope));
  let dashboards = dashboardsPairs.flat();
  dashboards = uniqBy(dashboards, (scopeDashboardBinding) => scopeDashboardBinding.spec.dashboard);

  return dashboards;
}
