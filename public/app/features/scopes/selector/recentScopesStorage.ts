import { type Scope, type Store } from '@grafana/data';
import { config } from '@grafana/runtime';

export const RECENT_SCOPES_KEY = 'grafana.scopes.recent';
export const RECENT_SCOPES_CHANGED_EVENT = 'grafana.scopes.recent-changed';
export const RECENT_SCOPES_MAX = 4;

export interface StoredRecentScopeSet {
  scopeIds: string[];
  scopeNodeId?: string;
  version: string;
}

export function readStoredRecentScopes(store: Store): StoredRecentScopeSet[] {
  const content = store.get(RECENT_SCOPES_KEY);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content || '[]');
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const currentVersion = config.buildInfo.version;
  const result: StoredRecentScopeSet[] = [];

  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !Array.isArray(entry.scopeIds) ||
      !entry.scopeIds.every((id: unknown) => typeof id === 'string') ||
      entry.scopeIds.length === 0
    ) {
      continue;
    }

    const cleaned: StoredRecentScopeSet = { scopeIds: entry.scopeIds, version: entry.version ?? '' };

    // Strip stale scopeNodeId if version doesn't match current build
    if (entry.scopeNodeId && entry.version === currentVersion) {
      cleaned.scopeNodeId = entry.scopeNodeId;
    }

    result.push(cleaned);
  }

  return result;
}

export function writeRecentScope(store: Store, scopes: Scope[], scopeNodeId?: string): void {
  if (scopes.length === 0) {
    return;
  }

  const scopeIds = scopes.map((s) => s.metadata.name);
  const hasDefaultPath = (scopes[0]?.spec.defaultPath?.length ?? 0) > 0;
  const version = config.buildInfo.version;

  const entry: StoredRecentScopeSet = { scopeIds, version };
  // Only store scopeNodeId when the scope lacks a defaultPath (it's the fallback navigation method)
  if (!hasDefaultPath && scopeNodeId) {
    entry.scopeNodeId = scopeNodeId;
  }

  const fingerprint = [...scopeIds].sort().join(',');
  const current = readStoredRecentScopes(store).filter((e) => [...e.scopeIds].sort().join(',') !== fingerprint);
  const updated = [entry, ...current].slice(0, RECENT_SCOPES_MAX);

  store.set(RECENT_SCOPES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(RECENT_SCOPES_CHANGED_EVENT));
}
