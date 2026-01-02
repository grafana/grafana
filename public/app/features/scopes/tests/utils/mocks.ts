import { DataSourceRef } from '@grafana/schema/dist/esm/common/common.gen';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

import {
  mocksNodes,
  mocksScopes,
  mocksScopeDashboardBindings,
  subScopeLokiItems,
  subScopeMimirItems,
  navigationWithSubScope,
  navigationWithSubScope2,
  navigationWithSubScopeAndGroups,
} from './mockData';

export { navigationWithSubScope, navigationWithSubScope2, navigationWithSubScopeAndGroups };

export const dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');

export const getMock = jest
  .fn()
  .mockImplementation(
    (url: string, params: { parent: string; scope: string[]; query?: string } & Record<string, string | string[]>) => {
      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_node_children')) {
        return {
          items: mocksNodes.filter(
            ({ spec: { title, parentName } }) =>
              parentName === params.parent && title.toLowerCase().includes((params.query ?? '').toLowerCase())
          ),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopes/', '');

        return mocksScopes.find((scope) => scope.metadata.name.toLowerCase() === name.toLowerCase()) ?? {};
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopenodes/')) {
        const name = url.replace('/apis/scope.grafana.app/v0alpha1/namespaces/default/scopenodes/', '');

        return mocksNodes.find((node) => node.metadata.name === name);
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_dashboard_bindings')) {
        return {
          items: mocksScopeDashboardBindings.filter(({ spec: { scope: bindingScope } }) =>
            params.scope.includes(bindingScope)
          ),
        };
      }

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_navigations')) {
        // Handle subScope fetch requests
        if (params.scope && params.scope.includes('mimir')) {
          return {
            items: subScopeMimirItems,
          };
        }
        if (params.scope && params.scope.includes('loki')) {
          return {
            items: subScopeLokiItems,
          };
        }
        // Return empty for other scopes
        return {
          items: [],
        };
      }

      if (url.startsWith('/api/dashboards/uid/')) {
        return {};
      }

      if (url.startsWith('/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards/')) {
        return {
          metadata: {
            name: '1',
          },
        };
      }

      return {};
    }
  );

export const getDatasource = async (ref: DataSourceRef) => {
  if (ref.uid === '-- Grafana --') {
    return {
      id: 1,
      uid: '-- Grafana --',
      name: 'grafana',
      type: 'grafana',
      meta: {
        id: 'grafana',
      },
    };
  }

  return {
    meta: {
      id: 'grafana-testdata-datasource',
    },
    name: 'grafana-testdata-datasource',
    type: 'grafana-testdata-datasource',
    uid: 'gdev-testdata',
    getRef: () => {
      return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
    },
  };
};

export const getInstanceSettings = () => ({
  id: 1,
  uid: 'gdev-testdata',
  name: 'testDs1',
  type: 'grafana-testdata-datasource',
  meta: {
    id: 'grafana-testdata-datasource',
  },
});
