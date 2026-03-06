import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

export type ResourceType = 'dashboards' | 'folders' | 'datasources';

export type AccessLevel = 'View' | 'Edit' | 'Admin' | 'Query';

export interface ParsedResource {
  /** The resource type this scope grants access to */
  type: ResourceType;
  /** The UID of the specific resource, or null for wildcards */
  uid: string | null;
  /** Whether this is a wildcard grant (access to ALL resources of this type) */
  isWildcard: boolean;
  /** Collapsed access level */
  accessLevel: AccessLevel;
  /** Raw actions that produced this access level */
  actions: string[];
  /**
   * If a dashboard action has a folder-scoped grant (folders:uid:X),
   * this is the folder UID — meaning "all dashboards in this folder"
   */
  folderUid?: string;
}

export interface ResourcePermissionsResult {
  resources: ParsedResource[];
  /** Resource types that have wildcard (all) access */
  wildcardTypes: Set<ResourceType>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Raw API response shape from /api/access-control/users/permissions/search */
type PermissionsSearchResponse = Record<string, Record<string, string[] | null>>;

const RESOURCE_PREFIXES: ResourceType[] = ['dashboards', 'folders', 'datasources'];

/**
 * Collapse raw actions into a human-readable access level.
 */
function deriveAccessLevel(type: ResourceType, actions: string[]): AccessLevel {
  const actionSet = new Set(actions);

  if (type === 'datasources') {
    if (actionSet.has('datasources:write')) {
      return 'Admin';
    }
    if (actionSet.has('datasources:query') || actionSet.has('datasources:read')) {
      return 'Query';
    }
    return 'View';
  }

  if (type === 'folders') {
    if (actionSet.has('folders:delete') || actionSet.has('folders:create')) {
      return 'Admin';
    }
    if (actionSet.has('folders:write')) {
      return 'Edit';
    }
    return 'View';
  }

  // dashboards
  if (actionSet.has('dashboards:permissions:read') || actionSet.has('dashboards:permissions:write')) {
    return 'Admin';
  }
  if (actionSet.has('dashboards:write') || actionSet.has('dashboards:delete')) {
    return 'Edit';
  }
  return 'View';
}

/**
 * Parse scopes from a single resource type's permission response into ParsedResource entries.
 */
function parsePermissions(type: ResourceType, actionMap: Record<string, string[] | null>): ParsedResource[] {
  // Collect all scopes per UID (or wildcard)
  const scopeActions = new Map<string, Set<string>>();
  const folderScopedDashboards = new Map<string, Set<string>>();

  for (const [action, scopes] of Object.entries(actionMap)) {
    if (scopes === null) {
      // Global action (no resource target) — skip
      continue;
    }

    for (const scope of scopes) {
      // Wildcard: "dashboards:*" or "folders:*" or "datasources:*"
      if (scope === `${type}:*`) {
        const key = `${type}:*`;
        if (!scopeActions.has(key)) {
          scopeActions.set(key, new Set());
        }
        scopeActions.get(key)!.add(action);
        continue;
      }

      // Specific resource: "dashboards:uid:abc123"
      const specificPrefix = `${type}:uid:`;
      if (scope.startsWith(specificPrefix)) {
        const uid = scope.slice(specificPrefix.length);
        if (!scopeActions.has(uid)) {
          scopeActions.set(uid, new Set());
        }
        scopeActions.get(uid)!.add(action);
        continue;
      }

      // Cross-type scope: dashboard action with folder scope "folders:uid:abc"
      // This means "all dashboards in this folder"
      if (type === 'dashboards' && scope.startsWith('folders:uid:')) {
        const folderUid = scope.slice('folders:uid:'.length);
        if (!folderScopedDashboards.has(folderUid)) {
          folderScopedDashboards.set(folderUid, new Set());
        }
        folderScopedDashboards.get(folderUid)!.add(action);
        continue;
      }

      // Also handle wildcard with "folders:*" on dashboard actions
      if (type === 'dashboards' && scope === 'folders:*') {
        const key = `${type}:*`;
        if (!scopeActions.has(key)) {
          scopeActions.set(key, new Set());
        }
        scopeActions.get(key)!.add(action);
      }
    }
  }

  const results: ParsedResource[] = [];

  // Convert collected scopes into ParsedResource entries
  for (const [key, actions] of scopeActions.entries()) {
    const isWildcard = key === `${type}:*`;
    const actionsArray = Array.from(actions);
    results.push({
      type,
      uid: isWildcard ? null : key,
      isWildcard,
      accessLevel: deriveAccessLevel(type, actionsArray),
      actions: actionsArray,
    });
  }

  // Add folder-scoped dashboard entries
  for (const [folderUid, actions] of folderScopedDashboards.entries()) {
    const actionsArray = Array.from(actions);
    results.push({
      type: 'dashboards',
      uid: null,
      isWildcard: false,
      accessLevel: deriveAccessLevel('dashboards', actionsArray),
      actions: actionsArray,
      folderUid,
    });
  }

  return results;
}

export type EntityType = 'service-account' | 'user';

/**
 * Fetch and parse all resource permissions for a user or service account.
 *
 * Makes 3 parallel API calls (dashboards, folders, datasources) and
 * returns structured data ready for the UI.
 *
 * @param entityId - The numeric ID of the user or service account
 * @param entityType - 'user' or 'service-account'
 */
export function useResourcePermissions(entityId: number, entityType: EntityType = 'service-account'): ResourcePermissionsResult {
  const [allResources, setAllResources] = useState<ParsedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        RESOURCE_PREFIXES.map((prefix) =>
          getBackendSrv()
            .get<PermissionsSearchResponse>(
              `/api/access-control/users/permissions/search`,
              {
                namespacedId: `${entityType}:${entityId}`,
                actionPrefix: `${prefix}:`,
              }
            )
            .then((response) => {
              // Response keyed by userId — grab the first (only) entry
              const userPerms = Object.values(response)[0];
              if (!userPerms) {
                return [];
              }
              return parsePermissions(prefix, userPerms);
            })
        )
      );

      setAllResources(results.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setIsLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions, refreshKey]);

  const wildcardTypes = useMemo(() => {
    const types = new Set<ResourceType>();
    for (const r of allResources) {
      if (r.isWildcard) {
        types.add(r.type);
      }
    }
    return types;
  }, [allResources]);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { resources: allResources, wildcardTypes, isLoading, error, refetch };
}
