/**
 * Types for Scopes API - matching @grafana/data types
 */

export interface ScopeFilter {
  key: string;
  value: string;
  operator: 'equals' | 'not-equals' | 'regex-match' | 'regex-not-match';
}

export interface ScopeSpec {
  title: string;
  filters: ScopeFilter[];
}

export interface Scope {
  metadata: {
    name: string;
  };
  spec: ScopeSpec;
}

export interface ScopeNodeSpec {
  nodeType: 'container' | 'leaf';
  title: string;
  description?: string;
  disableMultiSelect?: boolean;
  linkType?: 'scope';
  linkId?: string;
  parentName: string;
}

export interface ScopeNode {
  metadata: {
    name: string;
  };
  spec: ScopeNodeSpec;
}

export interface ScopeDashboardBindingSpec {
  dashboard: string;
  scope: string;
}

export interface ScopeDashboardBindingStatus {
  dashboardTitle: string;
  groups?: string[];
}

export interface ScopeDashboardBinding {
  metadata: {
    name: string;
  };
  spec: ScopeDashboardBindingSpec;
  status: ScopeDashboardBindingStatus;
}

export interface ScopeNavigation {
  metadata: {
    name: string;
  };
  spec: {
    url: string;
    scope: string;
    subScope?: string;
    preLoadSubScopeChildren?: boolean;
    expandOnLoad?: boolean;
    disableSubScopeSelection?: boolean;
  };
  status: {
    title: string;
    groups?: string[];
  };
}

export const MOCK_SCOPES: Scope[] = [
  {
    metadata: { name: 'cloud' },
    spec: {
      title: 'Cloud',
      filters: [{ key: 'cloud', value: '.*', operator: 'regex-match' }],
    },
  },
  {
    metadata: { name: 'dev' },
    spec: {
      title: 'Dev',
      filters: [{ key: 'cloud', value: 'dev', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'ops' },
    spec: {
      title: 'Ops',
      filters: [{ key: 'cloud', value: 'ops', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'prod' },
    spec: {
      title: 'Prod',
      filters: [{ key: 'cloud', value: 'prod', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'grafana' },
    spec: {
      title: 'Grafana',
      filters: [{ key: 'app', value: 'grafana', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'mimir' },
    spec: {
      title: 'Mimir',
      filters: [{ key: 'app', value: 'mimir', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'loki' },
    spec: {
      title: 'Loki',
      filters: [{ key: 'app', value: 'loki', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'tempo' },
    spec: {
      title: 'Tempo',
      filters: [{ key: 'app', value: 'tempo', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'dev-env' },
    spec: {
      title: 'Development',
      filters: [{ key: 'environment', value: 'dev', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'prod-env' },
    spec: {
      title: 'Production',
      filters: [{ key: 'environment', value: 'prod', operator: 'equals' }],
    },
  },
];

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

export const MOCK_SCOPE_DASHBOARD_BINDINGS: ScopeDashboardBinding[] = [
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
];

export const MOCK_NODES: ScopeNode[] = [
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
  {
    metadata: { name: 'environments' },
    spec: {
      nodeType: 'container',
      title: 'Environments',
      description: 'Environment Scopes',
      disableMultiSelect: true,
      parentName: '',
    },
  },
  {
    metadata: { name: 'environments-dev' },
    spec: {
      nodeType: 'container',
      title: 'Development',
      description: 'Development Environment',
      linkType: 'scope',
      linkId: 'dev-env',
      parentName: 'environments',
    },
  },
  {
    metadata: { name: 'environments-prod' },
    spec: {
      nodeType: 'container',
      title: 'Production',
      description: 'Production Environment',
      linkType: 'scope',
      linkId: 'prod-env',
      parentName: 'environments',
    },
  },
];

export const MOCK_SUB_SCOPE_MIMIR_ITEMS: ScopeNavigation[] = [
  {
    metadata: { name: 'mimir-item-1' },
    spec: {
      scope: 'mimir',
      url: '/d/mimir-dashboard-1',
    },
    status: {
      title: 'Mimir Dashboard 1',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'mimir-item-2' },
    spec: {
      scope: 'mimir',
      url: '/d/mimir-dashboard-2',
    },
    status: {
      title: 'Mimir Dashboard 2',
      groups: ['Observability'],
    },
  },
];

export const MOCK_SUB_SCOPE_LOKI_ITEMS: ScopeNavigation[] = [
  {
    metadata: { name: 'loki-item-1' },
    spec: {
      scope: 'loki',
      url: '/d/loki-dashboard-1',
    },
    status: {
      title: 'Loki Dashboard 1',
      groups: ['General'],
    },
  },
];
