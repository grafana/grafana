import { Scope, ScopeDashboardBinding, ScopeNode } from '@grafana/data';
import { config } from '@grafana/runtime';
import { scopeAPIv0alpha1 } from 'app/api/clients/scope/v0alpha1';
import { getMessageFromError } from 'app/core/utils/errors';
import { dispatch } from 'app/store/store';

import { ScopeNavigation } from './dashboards/types';

export class ScopesApiClient {
  async fetchScope(name: string): Promise<Scope | undefined> {
    const subscription = dispatch(scopeAPIv0alpha1.endpoints.getScope.initiate({ name }, { subscribe: false }));
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns a Scope type compatible with @grafana/data Scope
        return result.data;
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error('Failed to fetch scope:', name, errorMessage);
      }

      return undefined;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch scope:', name, errorMessage);
      return undefined;
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
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
          'Failed to fetch',
          failedCount,
          'of',
          scopesIds.length,
          'scope(s). Requested IDs:',
          scopesIds.join(', ')
        );
      }

      return successfulScopes;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch multiple scopes:', scopesIds, errorMessage);
      return [];
    }
  }

  async fetchMultipleScopeNodes(names: string[]): Promise<ScopeNode[]> {
    if (!config.featureToggles.useMultipleScopeNodesEndpoint || names.length === 0) {
      return Promise.resolve([]);
    }

    const subscription = dispatch(
      scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate({ names }, { subscribe: false })
    );
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error('Failed to fetch multiple scope nodes:', names, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch multiple scope nodes:', names, errorMessage);
      return [];
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
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

    const subscription = dispatch(
      scopeAPIv0alpha1.endpoints.getFindScopeNodeChildrenResults.initiate(
        {
          parent: options.parent,
          query: options.query,
          limit,
        },
        { subscribe: false, forceRefetch: true } // Froce refetch for search. Revisit this when necessary
      )
    );
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeNode
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        const contextParts: string[] = [];
        if (options.parent) {
          contextParts.push('parent="' + options.parent + '"');
        }
        if (options.query) {
          contextParts.push('query="' + options.query + '"');
        }
        contextParts.push('limit=' + limit);
        const context = contextParts.join(', ');
        console.error('Failed to fetch scope nodes:', context, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      const contextParts: string[] = [];
      if (options.parent) {
        contextParts.push('parent="' + options.parent + '"');
      }
      if (options.query) {
        contextParts.push('query="' + options.query + '"');
      }
      contextParts.push('limit=' + limit);
      const context = contextParts.join(', ');
      console.error('Failed to fetch scope nodes:', context, errorMessage);
      return [];
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
    }
  }

  public fetchDashboards = async (scopeNames: string[]): Promise<ScopeDashboardBinding[]> => {
    const subscription = dispatch(
      // Note: `name` is required by generated types but ignored by the query builder (codegen bug)
      scopeAPIv0alpha1.endpoints.getFindScopeDashboardBindingsResults.initiate(
        {
          name: '',
          scope: scopeNames,
        },
        { subscribe: false }
      )
    );
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns items compatible with @grafana/data ScopeDashboardBinding
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error('Failed to fetch dashboards for scopes:', scopeNames, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch dashboards for scopes:', scopeNames, errorMessage);
      return [];
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
    }
  };

  public fetchScopeNavigations = async (scopeNames: string[]): Promise<ScopeNavigation[]> => {
    const subscription = dispatch(
      // Note: `name` is required by generated types but ignored by the query builder (codegen bug)
      scopeAPIv0alpha1.endpoints.getFindScopeNavigationsResults.initiate(
        {
          name: '',
          scope: scopeNames,
        },
        { subscribe: false }
      )
    );
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns items compatible with ScopeNavigation
        return result.data.items ?? [];
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error('Failed to fetch scope navigations for scopes:', scopeNames, errorMessage);
      }

      return [];
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch scope navigations for scopes:', scopeNames, errorMessage);
      return [];
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
    }
  };

  public fetchScopeNode = async (scopeNodeId: string): Promise<ScopeNode | undefined> => {
    if (!config.featureToggles.useScopeSingleNodeEndpoint) {
      return Promise.resolve(undefined);
    }

    const subscription = dispatch(
      scopeAPIv0alpha1.endpoints.getScopeNode.initiate({ name: scopeNodeId }, { subscribe: false })
    );
    try {
      const result = await subscription;

      if ('data' in result && result.data) {
        // The generated API returns a ScopeNode type compatible with @grafana/data ScopeNode
        return result.data;
      }

      if ('error' in result) {
        const errorMessage = getMessageFromError(result.error);
        console.error('Failed to fetch scope node:', scopeNodeId, errorMessage);
      }

      return undefined;
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      console.error('Failed to fetch scope node:', scopeNodeId, errorMessage);
      return undefined;
    } finally {
      // Unsubscribe for extra safety, even though with subscribe: false and awaiting,
      // the request completes before return, so this is mostly a no-op
      subscription.unsubscribe();
    }
  };
}
