import { uniq, uniqBy } from 'lodash';

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

const dashboardsCache: Record<string, ScopeDashboard> = {};

const scopesToDashboardsCache: Record<string, string[]> = {};

async function fetchUids(scope: Scope): Promise<string[]> {
  const scopeName = scope.metadata.name;

  if (scopesToDashboardsCache[scopeName]) {
    return scopesToDashboardsCache[scopeName];
  }

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

    scopesToDashboardsCache[scopeName] =
      response.items.map((item) => item.spec.dashboard).filter((dashboardUid) => !!dashboardUid) ?? [];

    return scopesToDashboardsCache[scopeName];
  } catch (err) {
    return [];
  }
}

async function fetchDashboardDetails(dashboardUid: string): Promise<ScopeDashboard | undefined> {
  if (dashboardsCache[dashboardUid]) {
    return dashboardsCache[dashboardUid];
  }

  try {
    const dashboard = await getBackendSrv().get(`${dashboardDetailsEndpoint}/${dashboardUid}`);

    dashboardsCache[dashboardUid] = {
      uid: dashboard.dashboard.uid,
      title: dashboard.dashboard.title,
      url: dashboard.meta.url,
    };

    return dashboardsCache[dashboardUid];
  } catch (err) {
    return undefined;
  }
}

async function fetchDashboardsDetails(dashboardUids: string[]): Promise<ScopeDashboard[]> {
  try {
    const dashboards = await Promise.all(
      uniq(dashboardUids).map((dashboardUid) => fetchDashboardDetails(dashboardUid))
    );

    return dashboards.filter((dashboard): dashboard is ScopeDashboard => !!dashboard);
  } catch (err) {
    return [];
  }
}

export async function fetchDashboards(scopes: Scope[]): Promise<ScopeDashboard[]> {
  const dashboardUids = await Promise.all(
    uniqBy(scopes, 'metadata.name').map((scope) => fetchUids(scope).catch(() => []))
  );

  return await fetchDashboardsDetails(dashboardUids.flat());
}
