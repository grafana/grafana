import { HttpResponse, http } from 'msw';

import { Scope } from '@grafana/data';

import { ScopeNavigation } from '../../../dashboards/types';

// Tree structure helper for defining navigation hierarchy
interface NavigationTreeNode {
  name: string;
  title: string;
  scope: string;
  subScope?: string;
  groups?: string[];
  children?: NavigationTreeNode[];
}

// Convert tree structure to flat navigation array
function treeToNavigations(node: NavigationTreeNode, parentPath: string[] = []): ScopeNavigation[] {
  const navigations: ScopeNavigation[] = [];
  const currentPath = [...parentPath, node.name];

  // Create navigation item for this node
  navigations.push({
    metadata: { name: node.name },
    spec: {
      url: `/d/${node.name}`,
      scope: node.scope,
      ...(node.subScope ? { subScope: node.subScope } : {}),
    },
    status: {
      title: node.title,
      ...(node.groups && node.groups.length > 0 ? { groups: node.groups } : {}),
    },
  });

  // Process children - they belong to the node's subScope or scope
  if (node.children) {
    for (const child of node.children) {
      // Children inherit the parent's subScope as their scope, or use parent's scope if no subScope
      const childScope = node.subScope || node.scope;
      const childWithScope = { ...child, scope: childScope };
      navigations.push(...treeToNavigations(childWithScope, currentPath));
    }
  }

  return navigations;
}

// Mock scopes that users can select - these match the scopes from test mocks
const MOCK_SCOPES: Scope[] = [
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
  {
    metadata: { name: 'dev-cluster' },
    spec: {
      title: 'Development Cluster',
      filters: [{ key: 'cluster', value: 'dev-cluster', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'prod-cluster' },
    spec: {
      title: 'Production Cluster',
      filters: [{ key: 'cluster', value: 'prod-cluster', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'shoe-org' },
    spec: {
      title: 'Shoe organization',
      filters: [{ key: 'organization', value: 'shoe', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'shoes' },
    spec: {
      title: 'Shoes',
      filters: [{ key: 'product', value: 'shoes', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'apparel' },
    spec: {
      title: 'Apparel',
      filters: [{ key: 'product', value: 'apparel', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'frontend' },
    spec: {
      title: 'Frontend',
      filters: [{ key: 'team', value: 'frontend', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'database' },
    spec: {
      title: 'Database',
      filters: [{ key: 'team', value: 'database', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'main-app' },
    spec: {
      title: 'Main App',
      filters: [{ key: 'app', value: 'main', operator: 'equals' }],
    },
  },
  {
    metadata: { name: 'kids-app' },
    spec: {
      title: 'Kids App',
      filters: [{ key: 'app', value: 'kids', operator: 'equals' }],
    },
  },
];

// Mock ScopeNavigations - using commonly selected scopes like 'cloud', 'dev', 'ops', 'prod'
// so they will match when users select these scopes
const MOCK_SCOPE_NAVIGATIONS: ScopeNavigation[] = [
  // Navigations for 'cloud' scope with groups
  {
    metadata: { name: 'cloud-overview' },
    spec: {
      url: '/d/cloud-overview',
      scope: 'cloud',
    },
    status: {
      title: 'Cloud Overview',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'cloud-analytics' },
    spec: {
      url: '/d/cloud-analytics',
      scope: 'cloud',
      subScope: 'prod-env',
    },
    status: {
      title: 'Cloud Analytics',
      groups: ['Analytics'],
    },
  },
  // Navigations for 'dev' scope
  {
    metadata: { name: 'dev-dashboard' },
    spec: {
      url: '/d/dev-dashboard',
      scope: 'dev',
    },
    status: {
      title: 'Dev Dashboard',
      groups: ['Development'],
    },
  },
  {
    metadata: { name: 'dev-metrics' },
    spec: {
      url: '/d/dev-metrics',
      scope: 'dev',
      subScope: 'dev-env',
    },
    status: {
      title: 'Dev Metrics',
      groups: ['Metrics', 'Development'],
    },
  },
  // Navigations for 'ops' scope
  {
    metadata: { name: 'ops-monitoring' },
    spec: {
      url: '/d/ops-monitoring',
      scope: 'ops',
    },
    status: {
      title: 'Operations Monitoring',
      groups: ['Operations'],
    },
  },
  {
    metadata: { name: 'ops-alerts' },
    spec: {
      url: '/d/ops-alerts',
      scope: 'ops',
    },
    status: {
      title: 'Operations Alerts',
      groups: ['Operations', 'Alerts'],
    },
  },
  // Navigations for 'prod' scope
  {
    metadata: { name: 'prod-overview' },
    spec: {
      url: '/d/prod-overview',
      scope: 'prod',
    },
    status: {
      title: 'Production Overview',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'prod-performance' },
    spec: {
      url: '/d/prod-performance',
      scope: 'prod',
      subScope: 'prod-env',
    },
    status: {
      title: 'Production Performance',
      groups: ['Performance'],
    },
  },
  // Navigations without groups
  {
    metadata: { name: 'prod-logs' },
    spec: {
      url: '/d/prod-logs',
      scope: 'prod',
    },
    status: {
      title: 'Production Logs',
    },
  },
  {
    metadata: { name: 'cloud-status' },
    spec: {
      url: '/d/cloud-status',
      scope: 'cloud',
    },
    status: {
      title: 'Cloud Status',
    },
  },
  {
    metadata: { name: 'dev-health' },
    spec: {
      url: '/d/dev-health',
      scope: 'dev',
    },
    status: {
      title: 'Development Health',
    },
  },
  {
    metadata: { name: 'ops-overview' },
    spec: {
      url: '/d/ops-overview',
      scope: 'ops',
    },
    status: {
      title: 'Operations Overview',
    },
  },
  // Navigation with subScope but no groups
  {
    metadata: { name: 'dev-logs' },
    spec: {
      url: '/d/dev-logs',
      scope: 'dev',
      subScope: 'dev-env',
    },
    status: {
      title: 'Development Logs',
    },
  },
  // Navigations for 'grafana' scope (in case users select it)
  {
    metadata: { name: 'grafana-overview' },
    spec: {
      url: '/d/grafana-overview',
      scope: 'grafana',
    },
    status: {
      title: 'Grafana Overview',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'grafana-dev-dashboard' },
    spec: {
      url: '/d/grafana-dev-dashboard',
      scope: 'grafana',
      subScope: 'dev',
    },
    status: {
      title: 'Grafana Dev Dashboard',
      groups: ['Development'],
    },
  },
  // Navigations for 'dev-env' scope (referenced by subScope in dev-metrics and dev-logs)
  {
    metadata: { name: 'dev-env-overview' },
    spec: {
      url: '/d/dev-env-overview',
      scope: 'dev-env',
    },
    status: {
      title: 'Development Environment Overview',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'dev-env-infrastructure' },
    spec: {
      url: '/d/dev-env-infrastructure',
      scope: 'dev-env',
    },
    status: {
      title: 'Development Infrastructure',
      groups: ['Infrastructure'],
    },
  },
  {
    metadata: { name: 'dev-env-cluster-metrics' },
    spec: {
      url: '/d/dev-env-cluster-metrics',
      scope: 'dev-env',
      subScope: 'dev-cluster',
    },
    status: {
      title: 'Development Cluster Metrics',
      groups: ['Metrics'],
    },
  },
  {
    metadata: { name: 'dev-env-cluster-logs' },
    spec: {
      url: '/d/dev-env-cluster-logs',
      scope: 'dev-env',
      subScope: 'dev-cluster',
    },
    status: {
      title: 'Development Cluster Logs',
    },
  },
  // Navigations for 'prod-env' scope (referenced by subScope in cloud-analytics and prod-performance)
  {
    metadata: { name: 'prod-env-overview' },
    spec: {
      url: '/d/prod-env-overview',
      scope: 'prod-env',
    },
    status: {
      title: 'Production Environment Overview',
      groups: ['General'],
    },
  },
  {
    metadata: { name: 'prod-env-monitoring' },
    spec: {
      url: '/d/prod-env-monitoring',
      scope: 'prod-env',
    },
    status: {
      title: 'Production Monitoring',
      groups: ['Monitoring'],
    },
  },
  {
    metadata: { name: 'prod-env-cluster-health' },
    spec: {
      url: '/d/prod-env-cluster-health',
      scope: 'prod-env',
      subScope: 'prod-cluster',
    },
    status: {
      title: 'Production Cluster Health',
      groups: ['Health'],
    },
  },
  // Navigations for 'dev-cluster' scope (nested subScope)
  {
    metadata: { name: 'dev-cluster-nodes' },
    spec: {
      url: '/d/dev-cluster-nodes',
      scope: 'dev-cluster',
    },
    status: {
      title: 'Development Cluster Nodes',
      groups: ['Infrastructure'],
    },
  },
  {
    metadata: { name: 'dev-cluster-services' },
    spec: {
      url: '/d/dev-cluster-services',
      scope: 'dev-cluster',
    },
    status: {
      title: 'Development Cluster Services',
    },
  },
  // Navigations for 'prod-cluster' scope (nested subScope)
  {
    metadata: { name: 'prod-cluster-nodes' },
    spec: {
      url: '/d/prod-cluster-nodes',
      scope: 'prod-cluster',
    },
    status: {
      title: 'Production Cluster Nodes',
      groups: ['Infrastructure'],
    },
  },
  {
    metadata: { name: 'prod-cluster-services' },
    spec: {
      url: '/d/prod-cluster-services',
      scope: 'prod-cluster',
    },
    status: {
      title: 'Production Cluster Services',
    },
  },
  // Shoe organization tree structure - matches the visual hierarchy
  ...(() => {
    const shoeOrgTree: NavigationTreeNode[] = [
      {
        name: 'global-overview',
        title: 'Global overview',
        scope: 'shoe-org',
      },
      {
        name: 'reliability-placeholder',
        title: 'Reliability',
        scope: 'shoe-org',
        groups: ['Reliability'],
      },
      {
        name: 'shoes',
        title: 'Shoes',
        scope: 'shoe-org',
        subScope: 'shoes',
        children: [
          {
            name: 'shoes-overview',
            title: 'Overview',
            scope: 'shoes',
          },
          {
            name: 'shoes-team-overview',
            title: 'Team Overview',
            scope: 'shoes',
          },
          {
            name: 'shoes-frontend',
            title: 'Frontend',
            scope: 'shoes',
            subScope: 'frontend',
            children: [
              {
                name: 'frontend-api',
                title: 'API Metrics',
                scope: 'frontend',
              },
              {
                name: 'frontend-ui',
                title: 'UI Performance',
                scope: 'frontend',
              },
            ],
          },
          {
            name: 'shoes-database',
            title: 'Database',
            scope: 'shoes',
            subScope: 'database',
            children: [
              {
                name: 'database-connections',
                title: 'Database Connections',
                scope: 'database',
              },
              {
                name: 'database-replication',
                title: 'Database Replication',
                scope: 'database',
              },
            ],
          },
          {
            name: 'shoes-main-app',
            title: 'Main App',
            scope: 'shoes',
            subScope: 'main-app',
            children: [
              {
                name: 'main-app-users',
                title: 'User Analytics',
                scope: 'main-app',
              },
              {
                name: 'main-app-revenue',
                title: 'Revenue Metrics',
                scope: 'main-app',
              },
            ],
          },
          {
            name: 'shoes-kids-app',
            title: 'Kids App',
            scope: 'shoes',
            subScope: 'kids-app',
            children: [
              {
                name: 'kids-app-features',
                title: 'Feature Usage',
                scope: 'kids-app',
              },
              {
                name: 'kids-app-engagement',
                title: 'User Engagement',
                scope: 'kids-app',
              },
            ],
          },
        ],
      },
      {
        name: 'apparel',
        title: 'Apparel',
        scope: 'shoe-org',
        subScope: 'apparel',
        children: [
          {
            name: 'apparel-product-overview',
            title: 'Product Overview',
            scope: 'apparel',
          },
        ],
      },
      {
        name: 'all-teams-placeholder',
        title: 'All Teams',
        scope: 'shoe-org',
        groups: ['Discovered dashboards'],
        children: [
          {
            name: 'others-placeholder',
            title: 'Others',
            scope: 'shoe-org',
            groups: ['All Teams'],
            children: [
              {
                name: 'latency-and-errors',
                title: 'Latency and Errors',
                scope: 'shoe-org',
                groups: ['Others'],
              },
            ],
          },
        ],
      },
    ];
    return shoeOrgTree.flatMap((node) => treeToNavigations(node));
  })(),
];

// Handler for fetching individual scopes
export const scopeHandler = http.get(
  '/apis/scope.grafana.app/v0alpha1/namespaces/:namespace/scopes/:scopeName',
  ({ params }) => {
    const scope = MOCK_SCOPES.find((s) => s.metadata.name === params.scopeName);

    if (!scope) {
      return HttpResponse.json({ message: 'scope not found' }, { status: 404 });
    }

    return HttpResponse.json(scope);
  }
);

// Handler for fetching scope navigations
export const scopeNavigationsHandler = http.get(
  '/apis/scope.grafana.app/v0alpha1/namespaces/:namespace/find/scope_navigations',
  ({ request, params }) => {
    const url = new URL(request.url);
    const scopeQueryParams = url.searchParams.getAll('scope');

    // Filter navigations based on scope query params if provided
    const items =
      scopeQueryParams.length > 0
        ? MOCK_SCOPE_NAVIGATIONS.filter((nav) => scopeQueryParams.includes(nav.spec.scope))
        : MOCK_SCOPE_NAVIGATIONS;

    return HttpResponse.json({ items });
  }
);

const handlers = [scopeHandler, scopeNavigationsHandler];

export default handlers;
