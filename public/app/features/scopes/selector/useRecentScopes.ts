import { useEffect, useSyncExternalStore } from 'react';

import { store } from '@grafana/data';
import { type Scope, type ScopeNode } from 'app/api/clients/scope/v0alpha1/endpoints.gen';

import {
  RECENT_SCOPES_CHANGED_EVENT,
  RECENT_SCOPES_KEY,
  readStoredRecentScopes,
  type StoredRecentScopeSet,
} from './recentScopesStorage';
import { type RecentScopeSet } from './types';
import { useScopesById, useScopeNodesByName } from './useRecentScopesApi';

function subscribe(callback: () => void) {
  window.addEventListener(RECENT_SCOPES_CHANGED_EVENT, callback);
  return () => window.removeEventListener(RECENT_SCOPES_CHANGED_EVENT, callback);
}

// Cache by serialized value to ensure stable references from useSyncExternalStore.
// React uses Object.is to compare snapshots; a new array on every call would cause
// infinite re-renders in React 18 concurrent mode.
let cachedJsonKey: string | undefined;
let cachedSnapshot: StoredRecentScopeSet[] = [];

function getSnapshot(): StoredRecentScopeSet[] {
  const fresh = readStoredRecentScopes(store);
  const jsonKey = JSON.stringify(fresh);
  if (jsonKey !== cachedJsonKey) {
    cachedJsonKey = jsonKey;
    cachedSnapshot = fresh;
  }
  return cachedSnapshot;
}

function resolveParentNodeTitle(
  set: StoredRecentScopeSet,
  scopesById: Record<string, Scope | undefined>,
  leafNodesById: Record<string, ScopeNode | undefined>,
  parentNodesById: Record<string, ScopeNode | undefined>
): string | undefined {
  const defaultPath = scopesById[set.scopeIds[0]]?.spec?.defaultPath ?? [];
  if (defaultPath.length > 1) {
    const parentId = defaultPath[defaultPath.length - 2];
    return parentId !== '' ? parentNodesById[parentId]?.spec?.title : undefined;
  }
  if (!set.scopeNodeId) {
    return undefined;
  }
  const leafNode = leafNodesById[set.scopeNodeId];
  // Prefer the leaf node's own subTitle (no extra request needed)
  const parentName = leafNode?.spec?.parentName;
  return leafNode?.spec?.subTitle ?? (parentName ? parentNodesById[parentName]?.spec?.title : undefined);
}

export function useRecentScopes(appliedScopeIds: string[]): RecentScopeSet[] {
  const storedScopes = useSyncExternalStore(subscribe, getSnapshot, () => []);

  // Filter out the currently applied scopes to avoid duplicates
  const appliedSet = new Set(appliedScopeIds);
  const filteredScopes = storedScopes.filter((set) => {
    if (set.scopeIds.length !== appliedScopeIds.length) {
      return true;
    }
    return !set.scopeIds.every((id) => appliedSet.has(id));
  });

  // Collect all unique scope IDs to fetch
  const allScopeIds = [...new Set(filteredScopes.flatMap((s) => s.scopeIds))];
  const scopesById = useScopesById(allScopeIds);

  // For sets without defaultPath, fetch the stored leaf node so we can read its parentName
  const leafNodeIds = [
    ...new Set(
      filteredScopes.flatMap((set) => {
        const defaultPath = scopesById[set.scopeIds[0]]?.spec?.defaultPath ?? [];
        return defaultPath.length === 0 && set.scopeNodeId ? [set.scopeNodeId] : [];
      })
    ),
  ];
  const leafNodesById = useScopeNodesByName(leafNodeIds);

  // Derive parent node IDs: from defaultPath[length-2] (preferred) or from leaf node's parentName
  // (only needed when the leaf node has no subTitle to use directly)
  const parentNodeIds = [
    ...new Set(
      filteredScopes.flatMap((set) => {
        const defaultPath = scopesById[set.scopeIds[0]]?.spec?.defaultPath ?? [];
        if (defaultPath.length > 1) {
          const parentId = defaultPath[defaultPath.length - 2];
          return parentId !== '' ? [parentId] : [];
        }
        if (set.scopeNodeId) {
          const leafNode = leafNodesById[set.scopeNodeId];
          // If the leaf node has a subTitle, we use it directly — no parent fetch needed
          const parentName = leafNode?.spec?.subTitle ? undefined : leafNode?.spec?.parentName;
          return parentName ? [parentName] : [];
        }
        return [];
      })
    ),
  ];

  const parentNodesById = useScopeNodesByName(parentNodeIds);

  // Lazy Zod validation — prune any entries that fail the schema check.
  // We write directly here (bypassing writeRecentScope) because we already have
  // StoredRecentScopeSet[] from the validator, not raw Scope objects.
  useEffect(() => {
    import('./recentScopesValidation')
      .then(({ validateStoredRecentScopes }) => validateStoredRecentScopes(storedScopes))
      .then((valid) => {
        if (valid.length !== storedScopes.length) {
          store.set(RECENT_SCOPES_KEY, JSON.stringify(valid));
          window.dispatchEvent(new Event(RECENT_SCOPES_CHANGED_EVENT));
        }
      })
      .catch(() => {
        // Validation is best-effort; failures are non-fatal
      });
  }, [storedScopes]);

  return filteredScopes.map((set) => {
    const scopes = set.scopeIds.flatMap((id) => {
      const scope = scopesById[id];
      return scope?.spec ? [{ id, title: scope.spec.title }] : [];
    });

    return {
      scopeIds: set.scopeIds,
      scopes,
      scopeNodeId: set.scopeNodeId,
      parentNodeTitle: resolveParentNodeTitle(set, scopesById, leafNodesById, parentNodesById),
    };
  });
}
