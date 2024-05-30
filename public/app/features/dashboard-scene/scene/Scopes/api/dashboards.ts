import { uniq } from 'lodash';

import { Scope, ScopeDashboardBindingSpec } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { ScopeDashboard } from 'app/features/dashboard-scene/scene/Scopes/types';

import { group, version } from './common';

const dashboardDetailsEndpoint = '/api/dashboards/uid';

const client = new ScopedResourceClient<ScopeDashboardBindingSpec, 'ScopeDashboardBinding'>({
  group,
  version,
  resource: 'scopedashboardbindings',
});

const dashboardsCache = new Map<string, Promise<ScopeDashboard>>();

const scopesToDashboardsCache = new Map<string, Promise<string[]>>();

async function fetchUids(scope: Scope): Promise<string[]> {
  const scopeName = scope.metadata.name;

  if (scopesToDashboardsCache.has(scopeName)) {
    return scopesToDashboardsCache.get(scopeName)!;
  }

  const response = new Promise<string[]>(async (resolve) => {
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

      resolve(response.items.map((item) => item.spec.dashboard).filter((dashboardUid) => !!dashboardUid) ?? []);
    } catch (err) {
      scopesToDashboardsCache.delete(scopeName);

      resolve([]);
    }
  });

  scopesToDashboardsCache.set(scopeName, response);

  return response;
}

async function fetchDashboardDetails(dashboardUid: string): Promise<ScopeDashboard> {
  if (dashboardsCache.has(dashboardUid)) {
    return dashboardsCache.get(dashboardUid)!;
  }

  const response = new Promise<ScopeDashboard>(async (resolve) => {
    try {
      const dashboard = await getBackendSrv().get(`${dashboardDetailsEndpoint}/${dashboardUid}`);

      resolve({
        uid: dashboard.dashboard.uid,
        title: dashboard.dashboard.title,
        url: dashboard.meta.url,
      });
    } catch (err) {
      dashboardsCache.delete(dashboardUid);

      resolve({
        uid: dashboardUid,
        url: '',
        title: '',
      });
    }
  });

  dashboardsCache.set(dashboardUid, response);

  return response;
}

export async function fetchDashboards(scopes: Scope[]): Promise<ScopeDashboard[]> {
  const dashboardUidsForScopes = await Promise.all(scopes.map(fetchUids));
  const dashboardUids = uniq(dashboardUidsForScopes.flat());
  const dashboards = await Promise.all(dashboardUids.map((dashboardUid) => fetchDashboardDetails(dashboardUid)));

  return dashboards.filter((dashboard) => dashboard.url !== '');
}
