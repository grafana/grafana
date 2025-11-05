import { HttpResponse, http } from 'msw';

import { Scope } from '@grafana/data';
import { getFolderFixtures } from '@grafana/test-utils/unstable';

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

// Get all dashboard UIDs from the mocked tree (used by dashboard handlers)
// This ensures we use dashboard UIDs that exist in the mocked dashboard API
const [mockTree] = getFolderFixtures();
const mockDashboards = mockTree.filter(
  (item): item is typeof item & { item: { kind: 'dashboard' } } => item.item.kind === 'dashboard'
);
const MOCK_DASHBOARD_UIDS = mockDashboards.map(({ item }) => item.uid);
const FALLBACK_DASHBOARD_UID = MOCK_DASHBOARD_UIDS[0] || 'dash-1';

// Helper function to get a dashboard UID by index (cycles through available dashboards)
let dashboardIndexCounter = 0;
function getNextDashboardUID(): string {
  if (MOCK_DASHBOARD_UIDS.length === 0) {
    return FALLBACK_DASHBOARD_UID;
  }
  const uid = MOCK_DASHBOARD_UIDS[dashboardIndexCounter % MOCK_DASHBOARD_UIDS.length];
  dashboardIndexCounter++;
  return uid;
}

// Reset counter for each tree conversion
function resetDashboardCounter() {
  dashboardIndexCounter = 0;
}

// Convert tree structure to flat navigation array
function treeToNavigations(node: NavigationTreeNode, parentPath: string[] = []): ScopeNavigation[] {
  const navigations: ScopeNavigation[] = [];
  const currentPath = [...parentPath, node.name];

  // Create navigation item for this node - assign different mocked dashboards
  navigations.push({
    metadata: { name: node.name },
    spec: {
      url: `/d/${getNextDashboardUID()}`,
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

// Mock scopes for shoe-org hierarchy
const MOCK_SCOPES: Scope[] = [
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

// Mock ScopeNavigations for shoe-org hierarchy
// Reset counter before creating navigations to ensure consistent distribution
resetDashboardCounter();
const MOCK_SCOPE_NAVIGATIONS: ScopeNavigation[] = [
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
