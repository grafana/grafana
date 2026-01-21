import { HttpResponse, http } from 'msw';

import {
  MOCK_NODES,
  MOCK_SCOPES,
  MOCK_SCOPE_DASHBOARD_BINDINGS,
  MOCK_SUB_SCOPE_LOKI_ITEMS,
  MOCK_SUB_SCOPE_MIMIR_ITEMS,
  ScopeNavigation,
} from '../../../../fixtures/scopes';
import { getErrorResponse } from '../../../helpers';

const API_BASE = '/apis/scope.grafana.app/v0alpha1/namespaces/:namespace';

/**
 * GET /apis/scope.grafana.app/v0alpha1/namespaces/:namespace/scopes/:name
 *
 * Fetches a single scope by name.
 */
const getScopeHandler = () =>
  http.get<{ namespace: string; name: string }>(`${API_BASE}/scopes/:name`, ({ params }) => {
    const { name } = params;
    const scope = MOCK_SCOPES.find((s) => s.metadata.name === name);

    if (!scope) {
      return HttpResponse.json(getErrorResponse(`scopes.scope.grafana.app "${name}" not found`, 404), {
        status: 404,
      });
    }

    return HttpResponse.json(scope);
  });

/**
 * GET /apis/scope.grafana.app/v0alpha1/namespaces/:namespace/scopenodes/:name
 *
 * Fetches a single scope node by name.
 */
const getScopeNodeHandler = () =>
  http.get<{ namespace: string; name: string }>(`${API_BASE}/scopenodes/:name`, ({ params }) => {
    const { name } = params;
    const node = MOCK_NODES.find((n) => n.metadata.name === name);

    if (!node) {
      return HttpResponse.json(getErrorResponse(`scopenodes.scope.grafana.app "${name}" not found`, 404), {
        status: 404,
      });
    }

    return HttpResponse.json(node);
  });

/**
 * GET /apis/scope.grafana.app/v0alpha1/namespaces/:namespace/find/scope_node_children
 *
 * Finds scope node children based on parent and query filters.
 */
const findScopeNodeChildrenHandler = () =>
  http.get(`${API_BASE}/find/scope_node_children`, ({ request }) => {
    const url = new URL(request.url);
    const parent = url.searchParams.get('parent') ?? '';
    const query = url.searchParams.get('query') ?? '';
    const limitParam = url.searchParams.get('limit');
    const names = url.searchParams.getAll('names');

    let filtered = MOCK_NODES.filter(
      (node) => node.spec.parentName === parent && node.spec.title.toLowerCase().includes(query.toLowerCase())
    );

    if (names.length > 0) {
      filtered = MOCK_NODES.filter((node) => names.includes(node.metadata.name));
    }

    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      filtered = filtered.slice(0, limit);
    }

    return HttpResponse.json({
      items: filtered,
    });
  });

/**
 * GET /apis/scope.grafana.app/v0alpha1/namespaces/:namespace/find/scope_dashboard_bindings
 *
 * Finds scope dashboard bindings for the given scope names.
 */
const findScopeDashboardBindingsHandler = () =>
  http.get(`${API_BASE}/find/scope_dashboard_bindings`, ({ request }) => {
    const url = new URL(request.url);
    const scopeNames = url.searchParams.getAll('scope');

    const bindings = MOCK_SCOPE_DASHBOARD_BINDINGS.filter((b) => scopeNames.includes(b.spec.scope));

    return HttpResponse.json({
      items: bindings,
    });
  });

/**
 * GET /apis/scope.grafana.app/v0alpha1/namespaces/:namespace/find/scope_navigations
 *
 * Finds scope navigations for the given scope names.
 */
const findScopeNavigationsHandler = () =>
  http.get(`${API_BASE}/find/scope_navigations`, ({ request }) => {
    const url = new URL(request.url);
    const scopeNames = url.searchParams.getAll('scope');

    let items: ScopeNavigation[] = [];

    if (scopeNames.includes('mimir')) {
      items = [...items, ...MOCK_SUB_SCOPE_MIMIR_ITEMS];
    }
    if (scopeNames.includes('loki')) {
      items = [...items, ...MOCK_SUB_SCOPE_LOKI_ITEMS];
    }

    return HttpResponse.json({
      items,
    });
  });

export default [
  getScopeHandler(),
  getScopeNodeHandler(),
  findScopeNodeChildrenHandler(),
  findScopeDashboardBindingsHandler(),
  findScopeNavigationsHandler(),
];
