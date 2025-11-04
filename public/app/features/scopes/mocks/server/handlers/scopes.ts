import { HttpResponse, http } from 'msw';

import { Scope } from '@grafana/data';

import { ScopeNavigation } from '../../../dashboards/types';

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
  // Navigation without groups
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
