import { UserStorage } from '@grafana/runtime/internal';

import { logWarning } from '../../Analytics';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { createStorageLoader } from '../../hooks/useGenericSavedSearches';
import { type NameResolvers, resolveMigratedNames } from '../legacy-migration/migrationResolve';
import { migrateLegacyRuleListUrlSync } from '../legacy-migration/migrationSync';
import { type RuleKind } from '../shared/ruleKind';
import { type RuleSearchFilter } from '../token-search/ruleSearchFilter';
import { serialize } from '../token-search/serializer';
import { tokenize } from '../token-search/tokenizer';

export const ALERT_SAVED_SEARCHES_STORAGE_KEY = 'alertRulesSavedSearches';
export const RECORDING_SAVED_SEARCHES_STORAGE_KEY = 'recordingRulesSavedSearches';
const LEGACY_SAVED_SEARCHES_STORAGE_KEY = 'savedSearches';
const MIGRATED_MARKER_VALUE = 'true';
const ALL_KINDS: RuleKind[] = ['alert', 'recording'];

export function storageKeyForKind(kind: RuleKind): string {
  return kind === 'alert' ? ALERT_SAVED_SEARCHES_STORAGE_KEY : RECORDING_SAVED_SEARCHES_STORAGE_KEY;
}

/** Once set, the copy never reruns, so user deletions and edits stick. */
export function migratedMarkerKeyForKind(kind: RuleKind): string {
  return `${storageKeyForKind(kind)}Migrated`;
}

async function isKindMigrated(userStorage: UserStorage, kind: RuleKind): Promise<boolean> {
  const marker = await userStorage.getItem(migratedMarkerKeyForKind(kind));
  return marker === MIGRATED_MARKER_VALUE;
}

/** Untyped legacy entries default to Alert; only an explicit `type:recording` routes to Recording. */
function destinationForLegacyQuery(query: string): RuleKind {
  const typeToken = tokenize(query).find((t) => t.key === 'type');
  return typeToken?.value === 'recording' ? 'recording' : 'alert';
}

async function migrateQuery(
  query: string,
  resolvers: NameResolvers
): Promise<{ query: string; droppedKeys: string[] }> {
  const sync = migrateLegacyRuleListUrlSync({ search: query });
  const resolved = await resolveMigratedNames(sync, resolvers);
  return { query: serialize(resolved.filter), droppedKeys: resolved.droppedKeys };
}

/** Id dedupe only covers a retry after a failed write; the marker prevents re-copying. */
async function migrateKind(
  kind: RuleKind,
  legacySearches: SavedSearch[],
  resolvers: NameResolvers,
  userStorage: UserStorage,
  serviceNamespace: string
): Promise<void> {
  const storageKey = storageKeyForKind(kind);
  const loadDestination = createStorageLoader({ storageKey, serviceNamespace });
  const destinationSearches = await loadDestination();
  const destinationIds = new Set(destinationSearches.map((s) => s.id));
  // Never create two defaults: copy the legacy default only into an empty slot.
  let hasDefault = destinationSearches.some((s) => s.isDefault);

  const newSearches: SavedSearch[] = [];
  for (const legacy of legacySearches) {
    if (destinationForLegacyQuery(legacy.query) !== kind || destinationIds.has(legacy.id)) {
      continue;
    }

    const { query } = await migrateQuery(legacy.query, resolvers);
    const copy: SavedSearch = { ...legacy, query, isDefault: legacy.isDefault && !hasDefault };
    newSearches.push(copy);
    hasDefault = hasDefault || copy.isDefault;
  }

  if (newSearches.length > 0) {
    await userStorage.setItem(storageKey, JSON.stringify([...destinationSearches, ...newSearches]));
  }

  await userStorage.setItem(migratedMarkerKeyForKind(kind), MIGRATED_MARKER_VALUE);
}

/** One-time copy per kind, marked done (`<storageKey>Migrated`) only after success. The legacy collection is never modified. */
export async function copyLegacySavedSearchesOnce(
  resolvers: NameResolvers,
  serviceNamespace = 'alerting'
): Promise<void> {
  const userStorage = new UserStorage(serviceNamespace);

  const migratedFlags = await Promise.all(ALL_KINDS.map((kind) => isKindMigrated(userStorage, kind)));
  const pendingKinds = ALL_KINDS.filter((_, index) => !migratedFlags[index]);
  if (pendingKinds.length === 0) {
    return;
  }

  const loadLegacy = createStorageLoader({ storageKey: LEGACY_SAVED_SEARCHES_STORAGE_KEY, serviceNamespace });
  const legacySearches = await loadLegacy();

  for (const kind of pendingKinds) {
    try {
      await migrateKind(kind, legacySearches, resolvers, userStorage, serviceNamespace);
    } catch {
      // Leave the marker unset to retry later; don't block the other kind.
      logWarning('Failed to copy legacy saved searches into a rule-list collection', { kind });
    }
  }
}

/** Still carries legacy-only tokens (`type:`/`group:`/`source:`) that canonical queries never contain. */
function needsMigration(query: string): boolean {
  return tokenize(query).some((t) => t.key === 'type' || t.key === 'group' || t.key === 'source');
}

/** A persistence failure never blocks applying the migrated query. */
export async function applySavedSearch(
  query: string,
  resolvers: NameResolvers,
  parseForKind: (query: string) => RuleSearchFilter,
  persist: (canonicalQuery: string) => Promise<void>
): Promise<{ filter: RuleSearchFilter; query: string; droppedKeys: string[] }> {
  if (!needsMigration(query)) {
    return { filter: parseForKind(query), query, droppedKeys: [] };
  }

  const migrated = await migrateQuery(query, resolvers);
  try {
    await persist(migrated.query);
  } catch {
    // Swallow: results still show if storage is unavailable.
  }
  return { filter: parseForKind(migrated.query), query: migrated.query, droppedKeys: migrated.droppedKeys };
}
