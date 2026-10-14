import { UserStorage } from '@grafana/runtime/internal';

import { logWarning } from '../../Analytics';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { createStorageLoader } from '../../hooks/useGenericSavedSearches';
import { type NameResolvers, resolveMigratedNames } from '../legacy-migration/migrationResolve';
import { migrateLegacyRuleListUrlSync } from '../legacy-migration/migrationSync';
import { type Criteria } from '../rule-search/criteria';
import { serialize } from '../rule-search/serializer';
import { tokenize } from '../rule-search/tokenizer';

export type SavedSearchKind = 'alert' | 'recording';

export const ALERT_SAVED_SEARCHES_STORAGE_KEY = 'alertRulesSavedSearches';
export const RECORDING_SAVED_SEARCHES_STORAGE_KEY = 'recordingRulesSavedSearches';
const LEGACY_SAVED_SEARCHES_STORAGE_KEY = 'savedSearches';
const MIGRATED_MARKER_VALUE = 'true';
const ALL_KINDS: SavedSearchKind[] = ['alert', 'recording'];

export function storageKeyForKind(kind: SavedSearchKind): string {
  return kind === 'alert' ? ALERT_SAVED_SEARCHES_STORAGE_KEY : RECORDING_SAVED_SEARCHES_STORAGE_KEY;
}

/** Once this is set, the collection is never touched by the migration again — a copied
 * entry the user deletes stays deleted, and a default they change stays changed. Keyed off
 * the destination storage key so it can't collide with an unrelated marker. */
export function migratedMarkerKeyForKind(kind: SavedSearchKind): string {
  return `${storageKeyForKind(kind)}Migrated`;
}

async function isKindMigrated(userStorage: UserStorage, kind: SavedSearchKind): Promise<boolean> {
  const marker = await userStorage.getItem(migratedMarkerKeyForKind(kind));
  return marker === MIGRATED_MARKER_VALUE;
}

/** An untyped legacy collection has no reliable GMA/DMA distinction, so only an explicit
 * `type:recording` token routes a legacy entry to Recording; everything else (including no
 * type at all) defaults to Alert. */
function destinationForLegacyQuery(query: string): SavedSearchKind {
  const typeToken = tokenize(query).find((t) => t.key === 'type');
  return typeToken?.value === 'recording' ? 'recording' : 'alert';
}

async function migrateQuery(
  query: string,
  resolvers: NameResolvers
): Promise<{ query: string; droppedKeys: string[] }> {
  const sync = migrateLegacyRuleListUrlSync({
    search: query,
    view: null,
    dataSource: null,
    alertState: null,
    ruleType: null,
    queryString: null,
  });
  const resolved = await resolveMigratedNames(sync, resolvers);
  return {
    query: serialize(resolved.criteria),
    droppedKeys: [...new Set([...sync.diagnostics.droppedKeys, ...resolved.droppedKeys])].sort(),
  };
}

/**
 * Copies every legacy entry destined for one kind into that kind's collection, then marks
 * the kind migrated so it is never processed again. The id-based dedupe guards a retry after
 * a failed write (nothing persisted yet, so nothing to skip); once the marker is set, this
 * function is never called again for that kind, so it does not need to guard against a
 * *successful* previous copy — the marker check in the caller already prevents that, which is
 * what makes a deleted copy stay deleted and a changed default stay changed.
 */
async function migrateKind(
  kind: SavedSearchKind,
  legacySearches: SavedSearch[],
  resolvers: NameResolvers,
  userStorage: UserStorage,
  serviceNamespace: string
): Promise<void> {
  const storageKey = storageKeyForKind(kind);
  const loadDestination = createStorageLoader({ storageKey, serviceNamespace });
  const destinationSearches = await loadDestination();
  const destinationIds = new Set(destinationSearches.map((s) => s.id));
  // Only carry a legacy default into an empty destination default slot — never create two
  // defaults in the same collection by copying in a second one.
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

  // Reached only if nothing above threw — persist the marker so this kind's collection is
  // never touched by the migration again, regardless of what the user does to it afterwards.
  await userStorage.setItem(migratedMarkerKeyForKind(kind), MIGRATED_MARKER_VALUE);
}

/**
 * One-time, idempotent copy of the legacy combined `savedSearches` collection into the
 * separate Alert/Recording collections, gated by a persistent per-kind migration marker
 * (`<storageKey>Migrated`) written only after that kind's copy succeeds. Once set, the
 * marker is authoritative: this never re-reads or re-writes that kind's collection again, so
 * a copied entry the user deletes stays deleted and a default they change stays changed — the
 * id-based dedupe below only has to cover a retry after a write that failed partway. Each
 * kind is migrated independently, so one kind's storage failure doesn't block the other kind
 * from completing (and its marker) on the same run. The legacy collection itself is never
 * modified.
 */
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
      // Leave this kind's marker unset so a later run retries it; don't let its failure
      // block the other kind from finishing (and being marked) on this same run.
      logWarning('Failed to copy legacy saved searches into a rule-list collection', { kind });
    }
  }
}

/** A copied-but-not-yet-canonicalized entry still carries one of the legacy-only tokens
 * that migration always strips (`type:`/`group:`/`source:`) — a canonical query for either
 * new page can never contain them. */
function needsMigration(query: string): boolean {
  return tokenize(query).some((t) => t.key === 'type' || t.key === 'group' || t.key === 'source');
}

/**
 * Applies a saved search: if its stored query still needs migration, runs the same query
 * conversion used for URL migration and persists the canonical form before returning
 * criteria to search with. A persistence failure never blocks applying — the caller still
 * gets criteria to search with even if the canonical form couldn't be saved back.
 * `droppedKeys` names the filters the conversion removed, so the caller can say so.
 */
export async function applySavedSearch(
  query: string,
  kind: SavedSearchKind,
  resolvers: NameResolvers,
  parseForKind: (query: string) => Criteria,
  persist: (canonicalQuery: string) => Promise<void>
): Promise<{ criteria: Criteria; query: string; droppedKeys: string[] }> {
  if (!needsMigration(query)) {
    return { criteria: parseForKind(query), query, droppedKeys: [] };
  }

  const migrated = await migrateQuery(query, resolvers);
  try {
    await persist(migrated.query);
  } catch {
    // Swallow: the user should still see results even if storage is unavailable.
  }
  return { criteria: parseForKind(migrated.query), query: migrated.query, droppedKeys: migrated.droppedKeys };
}
