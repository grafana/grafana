import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { getAPINamespace } from '../../api/utils';

import { ScopeNavigation } from './dashboards/types';

const apiGroup = 'scope.grafana.app';
const apiVersion = 'v0alpha1';
const apiNamespace = getAPINamespace();
const apiUrl = `/apis/${apiGroup}/${apiVersion}/namespaces/${apiNamespace}`;

export class ScopesApiClient {
  async fetchScope(name: string): Promise<Scope | undefined> {
    try {
      return await getBackendSrv().get<Scope>(apiUrl + `/scopes/${name}`);
    } catch (err) {
      // TODO: maybe some better error handling
      console.error(err);
      return undefined;
    }
  }

  async fetchMultipleScopes(scopesIds: string[]): Promise<Scope[]> {
    const scopes = await Promise.all(scopesIds.map((id) => this.fetchScope(id)));
    return scopes.filter((scope) => scope !== undefined);
  }

  /**
   * Fetches a map of nodes based on the specified options.
   *
   * @param {Object} options An object to configure the node fetch operation.
   * @param {string|undefined} options.parent The parent node identifier to fetch children for, or undefined if no parent scope is required.
   * @param {string|undefined} options.query A query string to filter the nodes, or undefined for no filtering.
   * @param {number|undefined} options.limit The maximum number of nodes to fetch, defaults to 1000 if undefined. Must be between 1 and 10000.
   * @return {Promise<ScopeNode[]>} A promise that resolves to a map of fetched nodes. Returns an empty object if an error occurs.
   */
  async fetchNodes(options: { parent?: string; query?: string; limit?: number }): Promise<ScopeNode[]> {
    const limit = options.limit ?? 1000;

    if (!(0 < limit && limit <= 10000)) {
      throw new Error('Limit must be between 1 and 10000');
    }

    try {
      const nodes =
        (
          await getBackendSrv().get<{ items: ScopeNode[] }>(apiUrl + `/find/scope_node_children`, {
            parent: options.parent,
            query: options.query,
            limit,
          })
        )?.items ?? [];

      return nodes;
    } catch (err) {
      return [];
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

  public fetchScopeNavigations = async (scopeNames: string[]): Promise<ScopeNavigation[]> => {
    try {
      const response = await getBackendSrv().get<{ items: ScopeNavigation[] }>(apiUrl + `/find/scope_navigations`, {
        scope: scopeNames,
      });

      return response?.items ?? [];
    } catch (err) {
      return [];
    }
  };
}
