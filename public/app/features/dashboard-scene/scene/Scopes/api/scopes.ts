import { Scope, ScopeSpec, ScopeTreeItemSpec } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';

import { group, namespace, version } from './common';

const nodesEndpoint = `/apis/${group}/${version}/namespaces/${namespace}/find`;

const client = new ScopedResourceClient<ScopeSpec, 'Scope'>({
  group,
  version,
  resource: 'scopes',
});

const cache: Record<string, Scope> = {};

export function getBasicScope(name: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: name,
      type: '',
      category: '',
      description: '',
    },
  };
}

export async function fetchScopeTreeItems(parent: string, query: string): Promise<ScopeTreeItemSpec[]> {
  try {
    return (await getBackendSrv().get<{ items: ScopeTreeItemSpec[] }>(nodesEndpoint, { parent, query }))?.items ?? [];
  } catch (err) {
    return [];
  }
}

export async function fetchScope(name: string): Promise<Scope> {
  if (cache[name]) {
    return cache[name];
  }

  const basicScope: Scope = getBasicScope(name);

  try {
    const serverScope = await client.get(name);

    const scope = {
      ...basicScope,
      metadata: {
        ...basicScope,
        ...serverScope.metadata,
      },
      spec: {
        ...basicScope,
        ...serverScope.spec,
      },
    };

    cache[name] = scope;

    return scope;
  } catch (err) {
    return basicScope;
  }
}
