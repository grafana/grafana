import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { config } from '@grafana/runtime';
import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { getMessageFromError } from 'app/core/utils/errors';
import { dispatch } from 'app/store/store';

import { ScopeNavigation } from './dashboards/types';

export class ScopesApiClient {
  async fetchScope(name: string): Promise<Scope | undefined> {
    try {
      const result = await dispatch(scopeAPIv0alpha1.endpoints.getScope.initiate({ name }, { subscribe: false }));

      if ('data' in result && result.data) {
        // The generated API returns a Scope type compatible with @grafana/data Scope
        return result.data;
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error(`Failed to fetch scope "${name}":`, errorMessage);
      }

      return undefined;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch scope "${name}":`, errorMessage);
      return undefined;
    }
  }

  async fetchMultipleScopes(scopesIds: string[]): Promise<Scope[]> {
    if (scopesIds.length === 0) {
      return [];
    }

    try {
      const scopes = await Promise.all(scopesIds.map((id) => this.fetchScope(id)));
      const successfulScopes = scopes.filter((scope) => scope !== undefined);

      if (successfulScopes.length < scopesIds.length) {
        const failedCount = scopesIds.length - successfulScopes.length;
        console.warn(
          `Failed to fetch ${failedCount} of ${scopesIds.length} scope(s). Requested IDs: ${scopesIds.join(', ')}`
        );
      }

      return successfulScopes;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch multiple scopes [${scopesIds.join(', ')}]:`, errorMessage);
      return [];
    }
  }

  async fetchMultipleScopeNodes(names: string[]): Promise<ScopeNode[]> {
    if (!config.featureToggles.useMultipleScopeNodesEndpoint || names.length === 0) {
      return Promise.resolve([]);
    }

    try {
      const result = await dispatch(
        scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate({ names }, { subscribe: false })
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error(`Failed to fetch multiple scope nodes [${names.join(', ')}]:`, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch multiple scope nodes [${names.join(', ')}]:`, errorMessage);
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
        scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate(
          {
            parent: options.parent,
            query: options.query,
            limit,
          },
          { subscribe: false, forceRefetch: true } // Froce refetch for search. Revisit this when necessary
        )
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        const context = [
          options.parent && `parent="${options.parent}"`,
          options.query && `query="${options.query}"`,
          `limit=${limit}`,
        ]
          .filter(Boolean)
          .join(', ');
        console.error(`Failed to fetch scope nodes (${context}):`, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      const context = [
        options.parent && `parent="${options.parent}"`,
        options.query && `query="${options.query}"`,
        `limit=${limit}`,
      ]
        .filter(Boolean)
        .join(', ');
      console.error(`Failed to fetch scope nodes (${context}):`, errorMessage);
      return [];
    }
  }

  public fetchDashboards = async (scopeNames: string[]): Promise<ScopeDashboardBinding[]> => {
    try {
      const result = await dispatch(
        // Note: `name` is required by generated types but ignored by the query builder (codegen bug)
        scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate(
          {
            name: '',
            scope: scopeNames,
          },
          { subscribe: false }
        )
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeDashboardBinding
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error(`Failed to fetch dashboards for scopes [${scopeNames.join(', ')}]:`, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch dashboards for scopes [${scopeNames.join(', ')}]:`, errorMessage);
      return [];
    }
  };

  public fetchScopeNavigations = async (scopeNames: string[]): Promise<ScopeNavigation[]> => {
    try {
      const result = await dispatch(
        // Note: `name` is required by generated types but ignored by the query builder (codegen bug)
        scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate(
          {
            name: '',
            scope: scopeNames,
          },
          { subscribe: false }
        )
      );

      if ('data' in result && result.data) {
        // The generated API returns items compatible with ScopeNavigation
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error(`Failed to fetch scope navigations for scopes [${scopeNames.join(', ')}]:`, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch scope navigations for scopes [${scopeNames.join(', ')}]:`, errorMessage);
      return [];
    }
  };

  public fetchScopeNode = async (scopeNodeId: string): Promise<ScopeNode | undefined> => {
    if (!config.featureToggles.useScopeSingleNodeEndpoint) {
      return Promise.resolve(undefined);
    }

    try {
      const result = await dispatch(
        scopeAPIv0alpha1.endpoints.getScopeNode.initiate({ name: scopeNodeId }, { subscribe: false })
      );

      if ('data' in result && result.data) {
        // The generated API returns a ScopeNode type compatible with @grafana/data ScopeNode
        return result.data;
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error(`Failed to fetch scope node "${scopeNodeId}":`, errorMessage);
      }

      return undefined;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error(`Failed to fetch scope node "${scopeNodeId}":`, errorMessage);
      return undefined;
    }
  };
}
