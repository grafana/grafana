import { lastValueFrom } from 'rxjs';

import { type DataQuery, generateUUID, store } from '@grafana/data';
import { config, getBackendSrv, reportInteraction } from '@grafana/runtime';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { DEFAULT_RICH_HISTORY_SETTINGS } from 'app/core/utils/richHistoryTypes';

import type { IndexedDBMigrationAccess } from './RichHistoryIndexedDBStorage';
import { RICH_HISTORY_KEY, type RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';
import { RICH_HISTORY_SETTING_KEYS } from './richHistoryLocalStorageUtils';

const METADATA_MIGRATION_COMPLETE = 'migrationComplete';
const METADATA_MIGRATION_ATTEMPTS = 'migrationAttempts';
const METADATA_LOCAL_MIGRATION_COMPLETE = 'localMigrationComplete';
const METADATA_REMOTE_MIGRATION_COMPLETE = 'remoteMigrationComplete';
const MAX_MIGRATION_ATTEMPTS = 3;

// Support escape hatch: setting this localStorage key and reloading clears the
// IndexedDB migration markers so migration re-runs on the next call.
const RESET_MIGRATION_KEY = 'grafana.debug.resetQueryHistoryMigration';

function isValidEntry(entry: unknown): entry is RichHistoryLocalStorageDTO {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  return (
    'ts' in entry &&
    typeof entry.ts === 'number' &&
    'datasourceName' in entry &&
    typeof entry.datasourceName === 'string' &&
    'starred' in entry &&
    typeof entry.starred === 'boolean' &&
    'comment' in entry &&
    typeof entry.comment === 'string' &&
    'queries' in entry &&
    Array.isArray(entry.queries)
  );
}

/**
 * Resolves datasource uids for a set of datasource names. Unknown names map to ''.
 * Deduplicates names so each datasource is looked up at most once.
 */
async function resolveDatasourceUids(names: string[]): Promise<Map<string, string>> {
  const uidByName = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(names)).map(async (name) => {
      const settings = await getDataSourceInstanceSettings(name);
      uidByName.set(name, settings?.uid || '');
    })
  );
  return uidByName;
}

/**
 * Resolves datasource names for a set of datasource uids. Unknown uids map to ''.
 * Deduplicates uids so each datasource is looked up at most once.
 */
async function resolveDatasourceNames(uids: string[]): Promise<Map<string, string>> {
  const nameByUid = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(uids)).map(async (uid) => {
      const settings = await getDataSourceInstanceSettings({ uid });
      nameByUid.set(uid, settings?.name || '');
    })
  );
  return nameByUid;
}

/** Shape of a single query history entry from the remote API. */
interface RemoteDTO {
  uid: string;
  createdAt: number; // seconds since epoch
  datasourceUid: string;
  starred: boolean;
  comment: string;
  queries: DataQuery[];
}

/** Shape of the paginated response from GET /api/query-history. */
interface RemoteQueryHistoryResponse {
  result: {
    queryHistory: RemoteDTO[];
    totalCount: number;
  };
}

const REMOTE_PAGE_LIMIT = 100;

/**
 * Migrates query history data from localStorage and (optionally) the remote
 * backend API into IndexedDB.
 *
 * Path A: localStorage data.
 * Path B: Remote API data (when `config.queryHistoryEnabled` is true).
 * Path C: No data anywhere — mark migration complete immediately.
 */
export async function migrateToIndexedDB(indexedDBStorage: IndexedDBMigrationAccess): Promise<void> {
  // Cross-tab guard: two tabs (e.g. a browser session restore) can otherwise run
  // the one-time migration concurrently. Path A is additionally protected by an
  // atomic flag check inside its transaction; Path B awaits network calls and
  // cannot be, so serialize the whole migration across tabs where the Web Locks
  // API exists. Where it doesn't (jsdom, legacy browsers), fall through unguarded.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('grafana-query-history-migration', () => runMigration(indexedDBStorage));
  }
  return runMigration(indexedDBStorage);
}

async function runMigration(indexedDBStorage: IndexedDBMigrationAccess): Promise<void> {
  // Support escape hatch: if the debug reset key is set, wipe IndexedDB state
  // so migration re-runs from scratch below. Semantic is "start over" — queries
  // are re-sourced from localStorage and/or the remote API.
  if (store.exists(RESET_MIGRATION_KEY)) {
    store.delete(RESET_MIGRATION_KEY);
    const db = await indexedDBStorage.getDB();
    await db.clear('queries');
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_COMPLETE, false);
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_ATTEMPTS, 0);
    await indexedDBStorage.setMetadata(METADATA_LOCAL_MIGRATION_COMPLETE, false);
    await indexedDBStorage.setMetadata(METADATA_REMOTE_MIGRATION_COMPLETE, false);
    reportInteraction('grafana_query_history_migration_reset', {});
  }

  // 1. Check if migration is already complete
  const migrationComplete = await indexedDBStorage.getMetadata(METADATA_MIGRATION_COMPLETE);
  if (migrationComplete === true) {
    return;
  }

  // 2. Stop automatic retries once the cap is reached. Do NOT mark migration
  // complete: leaving it incomplete lets a future fixed build (or the support
  // reset key) recover the data. Don't grow the counter past the cap.
  const rawAttempts = await indexedDBStorage.getMetadata(METADATA_MIGRATION_ATTEMPTS);
  const currentAttempts = typeof rawAttempts === 'number' ? rawAttempts : 0;

  if (currentAttempts >= MAX_MIGRATION_ATTEMPTS) {
    reportInteraction('grafana_query_history_migration_abandoned', { attempts: currentAttempts });
    console.warn(
      `Query history migration to IndexedDB did not succeed after ${MAX_MIGRATION_ATTEMPTS} attempts. ` +
        `Existing query history remains in localStorage and/or the remote API. ` +
        `Set localStorage key '${RESET_MIGRATION_KEY}' to true and reload to retry the migration.`
    );
    return;
  }

  const attemptNumber = currentAttempts + 1;
  await indexedDBStorage.setMetadata(METADATA_MIGRATION_ATTEMPTS, attemptNumber);

  // 3. Read localStorage data
  const rawData: unknown[] = store.getObject(RICH_HISTORY_KEY, []);
  const hasLocalStorageData = rawData && rawData.length > 0;
  const hasRemoteData = config.queryHistoryEnabled === true;

  // Path C: No data in either source
  if (!hasLocalStorageData && !hasRemoteData) {
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_COMPLETE, true);
    return;
  }

  // Path A and B are independent — failure of one should not block the other.
  // Per-path flags prevent re-running a path that already succeeded on a prior attempt.
  let localSuccess = true;
  let remoteSuccess = true;

  const localAlreadyDone = (await indexedDBStorage.getMetadata(METADATA_LOCAL_MIGRATION_COMPLETE)) === true;
  const remoteAlreadyDone = (await indexedDBStorage.getMetadata(METADATA_REMOTE_MIGRATION_COMPLETE)) === true;

  // Path A: localStorage data exists. The completion flag is committed inside
  // migrateFromLocalStorage's transaction, atomically with the entry writes.
  if (hasLocalStorageData && !localAlreadyDone) {
    try {
      await migrateFromLocalStorage(indexedDBStorage, rawData, attemptNumber);
    } catch (error) {
      localSuccess = false;
      // Telemetry already reported inside migrateFromLocalStorage
    }
  }

  // Settings live in localStorage keys independent of the history entries, and the
  // writes are idempotent. Run them outside the entry-write guard so a settings
  // failure on a previous attempt is retried even though the entry writes are
  // already flagged done.
  if (hasLocalStorageData && localSuccess) {
    try {
      await migrateSettings(indexedDBStorage);
    } catch (error) {
      localSuccess = false;
      reportInteraction('grafana_query_history_migration_failed', {
        source: 'localStorage-settings',
        error: error instanceof Error ? error.message : String(error),
        attemptNumber,
      });
    }
  }

  // Path B: remote API data exists
  if (hasRemoteData && !remoteAlreadyDone) {
    try {
      await migrateFromRemoteStorage(indexedDBStorage, attemptNumber);
      await indexedDBStorage.setMetadata(METADATA_REMOTE_MIGRATION_COMPLETE, true);
    } catch (error) {
      remoteSuccess = false;
      // Telemetry already reported inside migrateFromRemoteStorage
    }
  }

  // Only mark complete if all applicable paths succeeded
  if (localSuccess && remoteSuccess) {
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_COMPLETE, true);
  }
}

async function migrateFromLocalStorage(
  indexedDBStorage: IndexedDBMigrationAccess,
  rawData: unknown[],
  attemptNumber: number
): Promise<void> {
  const validEntries = rawData.filter(isValidEntry);
  const itemCount = rawData.length;

  reportInteraction('grafana_query_history_migration_started', {
    source: 'localStorage',
    itemCount,
  });

  const startTime = Date.now();
  let itemsWritten = 0;
  let invalidEntriesSkipped = 0;

  try {
    // Resolve each datasource's uid up front: the async settings lookup cannot run
    // inside the IndexedDB transaction below (a non-IDB await would let the
    // transaction auto-commit early), so build a name->uid map first.
    const uidByName = await resolveDatasourceUids(validEntries.map((entry) => entry.datasourceName));

    const db = await indexedDBStorage.getDB();

    // Single transaction over both stores: the completion-flag re-check, the entry
    // writes, and the flag write commit atomically. IndexedDB serializes overlapping
    // readwrite transactions across connections, so a second tab racing this one
    // sees the flag and writes nothing. A transaction auto-commits once control
    // returns to the event loop with no pending IDB requests — only synchronous
    // calls and IDB awaits are allowed inside.
    const tx = db.transaction(['queries', 'metadata'], 'readwrite');
    const alreadyDone = (await tx.objectStore('metadata').get(METADATA_LOCAL_MIGRATION_COMPLETE)) === true;
    if (!alreadyDone) {
      for (const entry of validEntries) {
        const datasourceUid = uidByName.get(entry.datasourceName) || '';

        const id = generateUUID();

        await tx.objectStore('queries').put({
          id,
          createdAt: entry.ts,
          datasourceUid,
          datasourceName: entry.datasourceName,
          starred: entry.starred ? 1 : 0,
          comment: entry.comment,
          queries: entry.queries,
        });
        itemsWritten++;
      }
      await tx.objectStore('metadata').put(true, METADATA_LOCAL_MIGRATION_COMPLETE);
    }
    await tx.done;

    invalidEntriesSkipped = itemCount - validEntries.length;

    // Do NOT delete localStorage key — preserved for rollback

    const durationMs = Date.now() - startTime;

    reportInteraction('grafana_query_history_migration_completed', {
      source: 'localStorage',
      itemCount,
      itemsWritten,
      durationMs,
      invalidEntriesSkipped,
    });
  } catch (error) {
    reportInteraction('grafana_query_history_migration_failed', {
      source: 'localStorage',
      error: error instanceof Error ? error.message : String(error),
      attemptNumber,
      itemCount,
      itemsWritten,
    });

    // Do NOT set migrationComplete — allows retry on next load
    throw error;
  }
}

/**
 * Pulls query history from the backend `/api/query-history` API into IndexedDB.
 * Paginates through all pages and deduplicates against entries already in IndexedDB.
 */
async function migrateFromRemoteStorage(
  indexedDBStorage: IndexedDBMigrationAccess,
  attemptNumber: number
): Promise<void> {
  const startTime = Date.now();
  let totalFetched = 0;
  let itemsWritten = 0;
  let duplicatesSkipped = 0;

  try {
    // Fetch first page to learn totalCount
    let page = 1;
    const firstResponse = await fetchRemotePage(page);
    const totalCount = firstResponse.result.totalCount;
    let allItems: RemoteDTO[] = firstResponse.result.queryHistory;

    reportInteraction('grafana_query_history_migration_started', {
      source: 'remote',
      itemCount: totalCount,
    });

    // Fetch remaining pages
    while (allItems.length < totalCount) {
      page++;
      const response = await fetchRemotePage(page);
      if (response.result.queryHistory.length === 0) {
        break;
      }
      allItems = allItems.concat(response.result.queryHistory);
    }

    totalFetched = allItems.length;

    // Resolve each datasource's name up front: the async settings lookup cannot run
    // inside the IndexedDB transaction below (a non-IDB await would let the
    // transaction auto-commit early), so build a uid->name map first.
    const nameByUid = await resolveDatasourceNames(allItems.map((dto) => dto.datasourceUid));

    // Write to IndexedDB with dedup
    const db = await indexedDBStorage.getDB();
    const tx = db.transaction('queries', 'readwrite');

    for (const dto of allItems) {
      const createdAtMs = dto.createdAt * 1000;

      // Dedup window: ±5 seconds accounts for clock drift between localStorage
      // timestamps and server-side createdAt. This is a one-time migration
      // heuristic (max 3 attempts). False positives (dropping a legitimately
      // different query to the same datasource within 5s) are unlikely and
      // acceptable for migration.
      const DEDUP_WINDOW_MS = 5000;
      const range = IDBKeyRange.bound(createdAtMs - DEDUP_WINDOW_MS, createdAtMs + DEDUP_WINDOW_MS);
      let cursor = await tx.store.index('by-createdAt').openCursor(range);
      let isDuplicate = false;
      while (cursor) {
        if (cursor.value.datasourceUid === dto.datasourceUid) {
          isDuplicate = true;
          break;
        }
        cursor = await cursor.continue();
      }
      if (isDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      // Look up datasource name from uid
      const datasourceName = nameByUid.get(dto.datasourceUid) || '';

      await tx.store.put({
        id: generateUUID(),
        createdAt: createdAtMs,
        datasourceUid: dto.datasourceUid,
        datasourceName,
        starred: dto.starred ? 1 : 0,
        comment: dto.comment,
        queries: dto.queries,
      });
      itemsWritten++;
    }
    await tx.done;

    const durationMs = Date.now() - startTime;

    reportInteraction('grafana_query_history_migration_completed', {
      source: 'remote',
      itemCount: totalFetched,
      itemsWritten,
      durationMs,
      duplicatesSkipped,
    });
  } catch (error) {
    reportInteraction('grafana_query_history_migration_failed', {
      source: 'remote',
      error: error instanceof Error ? error.message : String(error),
      attemptNumber,
      itemCount: totalFetched,
      itemsWritten,
    });

    throw error;
  }
}

async function fetchRemotePage(page: number): Promise<RemoteQueryHistoryResponse> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<RemoteQueryHistoryResponse>({
      method: 'GET',
      url: `/api/query-history?limit=${REMOTE_PAGE_LIMIT}&page=${page}`,
      requestId: 'query-history-migration',
    })
  );
  return response.data;
}

async function migrateSettings(indexedDBStorage: IndexedDBMigrationAccess): Promise<void> {
  // Only carry over an explicitly-set legacy retention. When the old localStorage value was never
  // set, seed the IndexedDB default rather than the legacy localStorage default (which was 7) so the
  // new backend's intended default of 14 applies. The legacy localStorage settings are left untouched.
  const rawRetention = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod);
  const retentionPeriod =
    typeof rawRetention === 'number' ? rawRetention : DEFAULT_RICH_HISTORY_SETTINGS.retentionPeriod;
  const starredTabAsFirstTab = store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false);

  // Check both the new key and the legacy key for activeDatasourcesOnly
  const activeDatasourcesOnly: boolean | undefined = store.getObject(RICH_HISTORY_SETTING_KEYS.activeDatasourcesOnly);
  const resolvedActiveDatasourcesOnly =
    activeDatasourcesOnly ?? store.getObject(RICH_HISTORY_SETTING_KEYS.legacyActiveDatasourceOnly, false);

  // Migrate datasource filters from old SelectableValue[] format to string[]
  const rawFilters: Array<{ value?: string }> = store.getObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, []);
  const lastUsedDatasourceFilters: string[] = rawFilters.map((sv) => sv.value).filter((v): v is string => Boolean(v));

  await indexedDBStorage.updateSettings({
    retentionPeriod,
    starredTabAsFirstTab,
    activeDatasourcesOnly: resolvedActiveDatasourcesOnly,
    lastUsedDatasourceFilters,
  });
}
