import { Scope, ScopeDashboard } from '@grafana/data';

import { ScopedResourceServer } from '../apiserver/server';
import { ResourceServer } from '../apiserver/types';

// config.bootData.settings.listDashboardScopesEndpoint || '/apis/scope.grafana.app/v0alpha1/scopedashboards';
// config.bootData.settings.listScopesEndpoint || '/apis/scope.grafana.app/v0alpha1/scopes';

interface ScopeServers {
  scopes: ResourceServer<Scope>;
  dashboards: ResourceServer<ScopeDashboard>;
}

let instance: ScopeServers | undefined = undefined;

export function getScopeServers() {
  if (!instance) {
    instance = {
      scopes: new ScopedResourceServer({
        group: 'scope.grafana.app',
        version: 'v0alpha1',
        resource: 'scopes',
      }),
      dashboards: new ScopedResourceServer({
        group: 'scope.grafana.app',
        version: 'v0alpha1',
        resource: 'scopedashboards',
      }),
    };
  }
  return instance;
}
