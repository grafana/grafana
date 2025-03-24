import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { getAPINamespace } from '../../api/utils';

import { NodeReason, NodesMap, SelectedScope, TreeScope } from './selector/types';
import { getEmptyScopeObject } from './utils';

const apiGroup = 'scope.grafana.app';
const apiVersion = 'v0alpha1';
const apiNamespace = getAPINamespace();
const apiUrl = `/apis/${apiGroup}/${apiVersion}/namespaces/${apiNamespace}`;

export class ScopesApiClient {
  private scopesCache = new Map<string, Promise<Scope>>();

  async fetchScope(name: string): Promise<Scope> {
    if (this.scopesCache.has(name)) {
      return this.scopesCache.get(name)!;
    }

    const response = new Promise<Scope>(async (resolve) => {
      const basicScope = getEmptyScopeObject(name);

      try {
        const serverScope = await getBackendSrv().get<Scope>(apiUrl + `/scopes/${name}`);

        const scope = {
          ...basicScope,
          ...serverScope,
          metadata: {
            ...basicScope.metadata,
            ...serverScope.metadata,
          },
          spec: {
            ...basicScope.spec,
            ...serverScope.spec,
          },
        };

        resolve(scope);
      } catch (err) {
        this.scopesCache.delete(name);

        resolve(basicScope);
      }
    });

    this.scopesCache.set(name, response);

    return response;
  }

  async fetchMultipleScopes(treeScopes: TreeScope[]): Promise<SelectedScope[]> {
    const scopes = await Promise.all(treeScopes.map(({ scopeName }) => this.fetchScope(scopeName)));

    return scopes.map<SelectedScope>((scope, idx) => {
      return {
        scope,
        path: treeScopes[idx].path,
      };
    });
  }

  /**
   * @param parent
   * @param query Filters by title substring
   */
  async fetchNode(parent: string, query: string): Promise<NodesMap> {
    try {
      const nodes =
        (await getBackendSrv().get<{ items: ScopeNode[] }>(apiUrl + `/find/scope_node_children`, { parent, query }))
          ?.items ?? [];

      return nodes.reduce<NodesMap>((acc, { metadata: { name }, spec }) => {
        acc[name] = {
          name,
          ...spec,
          expandable: spec.nodeType === 'container',
          selectable: spec.linkType === 'scope',
          expanded: false,
          query: '',
          reason: NodeReason.Result,
          nodes: {},
        };
        return acc;
      }, {});
    } catch (err) {
      return {};
    }
  }

  public fetchDashboards = async (scopeNames: string[]): Promise<ScopeDashboardBinding[]> => {
    try {
      const response = await getBackendSrv().get<{ items: ScopeDashboardBinding[] }>(
        apiUrl + `/find/scope_dashboard_bindings`,
        {
          scope: scopeNames,
        }
      );

      return response?.items ?? [];
    } catch (err) {
      return [];
    }
  };
}
