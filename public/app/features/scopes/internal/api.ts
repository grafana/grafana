import {
  InternalScopeNodeReason,
  InternalScopeNodesMap,
  InternalSelectedScope,
  InternalTreeScope,
  Scope,
  ScopeDashboardBinding,
  ScopeNode,
  ScopeSpec,
} from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';

import { getBasicScope, mergeScopes } from './utils';

const group = 'scope.grafana.app';
const version = 'v0alpha1';
const namespace = config.namespace ?? 'default';

const nodesEndpoint = `/apis/${group}/${version}/namespaces/${namespace}/find/scope_node_children`;
const dashboardsEndpoint = `/apis/${group}/${version}/namespaces/${namespace}/find/scope_dashboard_bindings`;

const scopesClient = new ScopedResourceClient<ScopeSpec, 'Scope'>({
  group,
  version,
  resource: 'scopes',
});

const scopesCache = new Map<string, Promise<Scope>>();

async function fetchScopeNodes(parent: string, query: string): Promise<ScopeNode[]> {
  try {
    return (await getBackendSrv().get<{ items: ScopeNode[] }>(nodesEndpoint, { parent, query }))?.items ?? [];
  } catch (err) {
    return [];
  }
}

export async function fetchNodes(parent: string, query: string): Promise<InternalScopeNodesMap> {
  return (await fetchScopeNodes(parent, query)).reduce<InternalScopeNodesMap>((acc, { metadata: { name }, spec }) => {
    acc[name] = {
      name,
      ...spec,
      isExpandable: spec.nodeType === 'container',
      isSelectable: spec.linkType === 'scope',
      isExpanded: false,
      query: '',
      reason: InternalScopeNodeReason.Result,
      nodes: {},
    };
    return acc;
  }, {});
}

export async function fetchScope(name: string): Promise<Scope> {
  if (scopesCache.has(name)) {
    return scopesCache.get(name)!;
  }

  const response = new Promise<Scope>(async (resolve) => {
    const basicScope = getBasicScope(name);

    try {
      const serverScope = await scopesClient.get(name);

      const scope = mergeScopes(basicScope, serverScope);

      resolve(scope);
    } catch (err) {
      scopesCache.delete(name);

      resolve(basicScope);
    }
  });

  scopesCache.set(name, response);

  return response;
}

export async function fetchScopes(names: string[]): Promise<Scope[]> {
  return await Promise.all(names.map(fetchScope));
}

export async function fetchSelectedScopes(treeScopes: InternalTreeScope[]): Promise<InternalSelectedScope[]> {
  const scopes = await fetchScopes(treeScopes.map(({ scopeName }) => scopeName));

  return scopes.reduce<InternalSelectedScope[]>((acc, scope, idx) => {
    acc.push({
      scope,
      path: treeScopes[idx].path,
    });

    return acc;
  }, []);
}

export async function fetchDashboards(scopeNames: string[]): Promise<ScopeDashboardBinding[]> {
  try {
    const response = await getBackendSrv().get<{ items: ScopeDashboardBinding[] }>(dashboardsEndpoint, {
      scope: scopeNames,
    });

    return response?.items ?? [];
  } catch (err) {
    return [];
  }
}
