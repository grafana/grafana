import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema/dist/esm/common/common.gen';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

export const mocksScopes: Scope[] = [
  {
    metadata: { name: 'cloud' },
    spec: {
      title: 'Cloud',
      type: 'indexHelper',
      description: 'redundant label filter but makes queries faster',
      category: 'indexHelpers',
      filters: [{ key: 'cloud', value: '.*', operator: 'regex-match' }],
    },
  },
  {
    metadata: { name: 'dev' },
    spec: {
      title: 'Dev',
      type: 'cloud',
      description: 'Dev',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'dev', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'ops' },
    spec: {
      title: 'Ops',
      type: 'cloud',
      description: 'Ops',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'ops', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'prod' },
    spec: {
      title: 'Prod',
      type: 'cloud',
      description: 'Prod',
      category: 'cloud',
      filters: [{ key: 'cloud', value: 'prod', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'grafana' },
    spec: {
      title: 'Grafana',
      type: 'app',
      description: 'Grafana',
      category: 'apps',
      filters: [{ key: 'app', value: 'grafana', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'mimir' },
    spec: {
      title: 'Mimir',
      type: 'app',
      description: 'Mimir',
      category: 'apps',
      filters: [{ key: 'app', value: 'mimir', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'loki' },
    spec: {
      title: 'Loki',
      type: 'app',
      description: 'Loki',
      category: 'apps',
      filters: [{ key: 'app', value: 'loki', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'tempo' },
    spec: {
      title: 'Tempo',
      type: 'app',
      description: 'Tempo',
      category: 'apps',
      filters: [{ key: 'app', value: 'tempo', operator: 'equals' }],
    },
  },
] as const;

const dashboardBindingsGenerator = (
  scopes: string[],
  dashboards: Array<{ dashboardTitle: string; dashboardKey?: string; groups?: string[] }>
) =>
  scopes.reduce<ScopeDashboardBinding[]>((scopeAcc, scopeTitle) => {
    const scope = scopeTitle.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');

    return [
      ...scopeAcc,
      ...dashboards.reduce<ScopeDashboardBinding[]>((acc, { dashboardTitle, groups, dashboardKey }, idx) => {
        dashboardKey = dashboardKey ?? dashboardTitle.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');
        const group = !groups
          ? ''
          : groups.length === 1
            ? groups[0] === ''
              ? ''
              : `${groups[0].toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}-`
            : `multiple${idx}-`;
        const dashboard = `${group}${dashboardKey}`;

        return [
          ...acc,
          {
            metadata: { name: `${scope}-${dashboard}` },
            spec: {
              dashboard,
              scope,
            },
            status: {
              dashboardTitle,
              groups,
            },
          },
        ];
      }, []),
    ];
  }, []);

export const mocksScopeDashboardBindings: ScopeDashboardBinding[] = [
  ...dashboardBindingsGenerator(
    ['Grafana'],
    [
      { dashboardTitle: 'Data Sources', groups: ['General'] },
      { dashboardTitle: 'Usage', groups: ['General'] },
      { dashboardTitle: 'Frontend Errors', groups: ['Observability'] },
      { dashboardTitle: 'Frontend Logs', groups: ['Observability'] },
      { dashboardTitle: 'Backend Errors', groups: ['Observability'] },
      { dashboardTitle: 'Backend Logs', groups: ['Observability'] },
      { dashboardTitle: 'Usage Overview', groups: ['Usage'] },
      { dashboardTitle: 'Data Sources', groups: ['Usage'] },
      { dashboardTitle: 'Stats', groups: ['Usage'] },
      { dashboardTitle: 'Overview', groups: [''] },
      { dashboardTitle: 'Frontend' },
      { dashboardTitle: 'Stats' },
    ]
  ),
  ...dashboardBindingsGenerator(
    ['Loki', 'Tempo', 'Mimir'],
    [
      { dashboardTitle: 'Ingester', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Distributor', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Compacter', groups: ['Components', 'Investigations'] },
      { dashboardTitle: 'Datasource Errors', groups: ['Observability', 'Investigations'] },
      { dashboardTitle: 'Datasource Logs', groups: ['Observability', 'Investigations'] },
      { dashboardTitle: 'Overview' },
      { dashboardTitle: 'Stats', dashboardKey: 'another-stats' },
    ]
  ),
  ...dashboardBindingsGenerator(
    ['Dev', 'Ops', 'Prod'],
    [
      { dashboardTitle: 'Overview', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Metrics', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Labels', groups: ['Cardinality Management'] },
      { dashboardTitle: 'Overview', groups: ['Usage Insights'] },
      { dashboardTitle: 'Data Sources', groups: ['Usage Insights'] },
      { dashboardTitle: 'Query Errors', groups: ['Usage Insights'] },
      { dashboardTitle: 'Alertmanager', groups: ['Usage Insights'] },
      { dashboardTitle: 'Metrics Ingestion', groups: ['Usage Insights'] },
      { dashboardTitle: 'Billing/Usage' },
    ]
  ),
] as const;

export const mocksNodes: ScopeNode[] = [
  {
    metadata: { name: 'applications' },
    spec: {
      nodeType: 'container',
      title: 'Applications',
      description: 'Application Scopes',
      parentName: '',
    },
  },
  {
    metadata: { name: 'cloud' },
    spec: {
      nodeType: 'container',
      title: 'Cloud',
      description: 'Cloud Scopes',
      disableMultiSelect: true,
      linkType: 'scope',
      linkId: 'cloud',
      parentName: '',
    },
  },
  {
    metadata: { name: 'applications-grafana' },
    spec: {
      nodeType: 'leaf',
      title: 'Grafana',
      description: 'Grafana',
      linkType: 'scope',
      linkId: 'grafana',
      parentName: 'applications',
    },
  },
  {
    metadata: { name: 'applications-mimir' },
    spec: {
      nodeType: 'leaf',
      title: 'Mimir',
      description: 'Mimir',
      linkType: 'scope',
      linkId: 'mimir',
      parentName: 'applications',
    },
  },
  {
    metadata: { name: 'applications-loki' },
    spec: {
      nodeType: 'leaf',
      title: 'Loki',
      description: 'Loki',
      linkType: 'scope',
      linkId: 'loki',
      parentName: 'applications',
    },
  },
  {
    metadata: { name: 'applications-tempo' },
    spec: {
      nodeType: 'leaf',
      title: 'Tempo',
      description: 'Tempo',
      linkType: 'scope',
      linkId: 'tempo',
      parentName: 'applications',
    },
  },
  {
    metadata: { name: 'applications-cloud' },
    spec: {
      nodeType: 'container',
      title: 'Cloud',
      description: 'Application/Cloud Scopes',
      linkType: 'scope',
      linkId: 'cloud',
      parentName: 'applications',
    },
  },
  {
    metadata: { name: 'applications-cloud-dev' },
    spec: {
      nodeType: 'leaf',
      title: 'Dev',
      description: 'Dev',
      linkType: 'scope',
      linkId: 'dev',
      parentName: 'applications-cloud',
    },
  },
  {
    metadata: { name: 'applications-cloud-ops' },
    spec: {
      nodeType: 'leaf',
      title: 'Ops',
      description: 'Ops',
      linkType: 'scope',
      linkId: 'ops',
      parentName: 'applications-cloud',
    },
  },
  {
    metadata: { name: 'applications-cloud-prod' },
    spec: {
      nodeType: 'leaf',
      title: 'Prod',
      description: 'Prod',
      linkType: 'scope',
      linkId: 'prod',
      parentName: 'applications-cloud',
    },
  },
  {
    metadata: { name: 'cloud-dev' },
    spec: {
      nodeType: 'leaf',
      title: 'Dev',
      description: 'Dev',
      linkType: 'scope',
      linkId: 'dev',
      parentName: 'cloud',
    },
  },
  {
    metadata: { name: 'cloud-ops' },
    spec: {
      nodeType: 'leaf',
      title: 'Ops',
      description: 'Ops',
      linkType: 'scope',
      linkId: 'ops',
      parentName: 'cloud',
    },
  },
  {
    metadata: { name: 'cloud-prod' },
    spec: {
      nodeType: 'leaf',
      title: 'Prod',
      description: 'Prod',
      linkType: 'scope',
      linkId: 'prod',
      parentName: 'cloud',
    },
  },
  {
    metadata: { name: 'cloud-applications' },
    spec: {
      nodeType: 'container',
      title: 'Applications',
      description: 'Cloud/Application Scopes',
      parentName: 'cloud',
    },
  },
  {
    metadata: { name: 'cloud-applications-grafana' },
    spec: {
      nodeType: 'leaf',
      title: 'Grafana',
      description: 'Grafana',
      linkType: 'scope',
      linkId: 'grafana',
      parentName: 'cloud-applications',
    },
  },
  {
    metadata: { name: 'cloud-applications-mimir' },
    spec: {
      nodeType: 'leaf',
      title: 'Mimir',
      description: 'Mimir',
      linkType: 'scope',
      linkId: 'mimir',
      parentName: 'cloud-applications',
    },
  },
  {
    metadata: { name: 'cloud-applications-loki' },
    spec: {
      nodeType: 'leaf',
      title: 'Loki',
      description: 'Loki',
      linkType: 'scope',
      linkId: 'loki',
      parentName: 'cloud-applications',
    },
  },
  {
    metadata: { name: 'cloud-applications-tempo' },
    spec: {
      nodeType: 'leaf',
      title: 'Tempo',
      description: 'Tempo',
      linkType: 'scope',
      linkId: 'tempo',
      parentName: 'cloud-applications',
    },
  },
] as const;

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

      if (url.startsWith('/apis/scope.grafana.app/v0alpha1/namespaces/default/find/scope_dashboard_bindings')) {
        return {
          items: mocksScopeDashboardBindings.filter(({ spec: { scope: bindingScope } }) =>
            params.scope.includes(bindingScope)
          ),
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

const generateScopeDashboardBinding = (dashboardTitle: string, groups?: string[], dashboardId?: string) => ({
  metadata: { name: `${dashboardTitle}-name` },
  spec: {
    dashboard: `${dashboardId ?? dashboardTitle}-dashboard`,
    scope: `${dashboardTitle}-scope`,
  },
  status: {
    dashboardTitle,
    groups,
  },
});

export const dashboardWithoutFolder: ScopeDashboardBinding = generateScopeDashboardBinding('Without Folder');
export const dashboardWithOneFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With one folder', [
  'Folder 1',
]);
export const dashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding('With two folders', [
  'Folder 1',
  'Folder 2',
]);
export const alternativeDashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative with two folders',
  ['Folder 1', 'Folder 2'],
  'With two folders'
);
export const dashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With root folder', ['']);
export const alternativeDashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative With root folder',
  [''],
  'With root folder'
);
export const dashboardWithRootFolderAndOtherFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'With root folder and other folder',
  ['', 'Folder 3']
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
