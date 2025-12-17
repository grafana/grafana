import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { config } from '@grafana/runtime';
import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { dispatch } from 'app/store/store';

import { ScopeNavigation } from './dashboards/types';

export class ScopesApiClient {
  async fetchScope(name: string): Promise<Scope | undefined> {
    try {
      const result = await dispatch(scopeAPIv0alpha1.endpoints.getScope.initiate({ name }));

      if ('data' in result && result.data) {
        // The generated API returns a Scope type compatible with @grafana/data Scope
        return result.data;
      }

      if ('error' in result) {
        console.error(result.error);
      }

      return undefined;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  async fetchMultipleScopes(scopesIds: string[]): Promise<Scope[]> {
    const scopes = await Promise.all(scopesIds.map((id) => this.fetchScope(id)));
    return scopes.filter((scope) => scope !== undefined);
  }

  async fetchMultipleScopeNodes(names: string[]): Promise<ScopeNode[]> {
    if (!config.featureToggles.useMultipleScopeNodesEndpoint || names.length === 0) {
      return Promise.resolve([]);
    }

    try {
      const result = await dispatch(scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate({ names }));

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      return [];
    } catch (err) {
      return [];
    }
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
      const result = await dispatch(
        scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate({
          parent: options.parent,
          query: options.query,
          limit,
        })
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      return [];
    } catch (err) {
      return [];
    }
  }

  public fetchDashboards = async (scopeNames: string[]): Promise<ScopeDashboardBinding[]> => {
    try {
      const result = await dispatch(
        scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate({
          name: 'scope_dashboard_bindings',
          scope: scopeNames,
        })
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeDashboardBinding
        return result.data.items ?? [];
      }

      return [];
    } catch (err) {
      return [];
    }
  };

  public fetchScopeNavigations = async (scopeNames: string[]): Promise<ScopeNavigation[]> => {
    try {
      const result = await dispatch(
        scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate({
          name: 'scope_navigations',
          scope: scopeNames,
        })
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with ScopeNavigation
        return result.data.items ?? [];
      }

      return [];
    } catch (err) {
      return [];
    }
  };

  public fetchScopeNode = async (scopeNodeId: string): Promise<ScopeNode | undefined> => {
    if (!config.featureToggles.useScopeSingleNodeEndpoint) {
      return Promise.resolve(undefined);
    }

    try {
      const result = await dispatch(scopeAPIv0alpha1.endpoints.getScopeNode.initiate({ name: scopeNodeId }));

      if ('data' in result && result.data) {
        // The generated API returns a ScopeNode type compatible with @grafana/data ScopeNode
        return result.data;
      }

      return undefined;
    } catch (err) {
      return undefined;
    }
  };
}
