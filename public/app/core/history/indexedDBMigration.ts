import { lastValueFrom } from 'rxjs';

import { type DataQuery, store } from '@grafana/data';
import { config, getBackendSrv, getDataSourceSrv, reportInteraction } from '@grafana/runtime';

import type RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';
import { RICH_HISTORY_KEY, type RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';
import { RICH_HISTORY_SETTING_KEYS } from './richHistoryLocalStorageUtils';

const METADATA_MIGRATION_COMPLETE = 'migrationComplete';
const METADATA_MIGRATION_ATTEMPTS = 'migrationAttempts';
const MAX_MIGRATION_ATTEMPTS = 3;

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
export async function migrateToIndexedDB(indexedDBStorage: RichHistoryIndexedDBStorage): Promise<void> {
  // 1. Check if migration is already complete
  const migrationComplete = await indexedDBStorage.getMetadata(METADATA_MIGRATION_COMPLETE);
  if (migrationComplete === true) {
    return;
  }

  // 2. Increment migration attempts counter and check max
  const rawAttempts = await indexedDBStorage.getMetadata(METADATA_MIGRATION_ATTEMPTS);
  const currentAttempts = typeof rawAttempts === 'number' ? rawAttempts : 0;
  const attemptNumber = currentAttempts + 1;
  await indexedDBStorage.setMetadata(METADATA_MIGRATION_ATTEMPTS, attemptNumber);

  if (attemptNumber > MAX_MIGRATION_ATTEMPTS) {
    reportInteraction('grafana_query_history_migration_abandoned', { attempts: currentAttempts });
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_COMPLETE, true);
    return;
  }

  // 3. Read localStorage data
  const rawData: unknown[] = store.getObject(RICH_HISTORY_KEY, []);
  const hasLocalStorageData = rawData && rawData.length > 0;
  const hasRemoteData = config.queryHistoryEnabled === true;

  // Path C: No data in either source
  if (!hasLocalStorageData && !hasRemoteData) {
    await indexedDBStorage.setMetadata(METADATA_MIGRATION_COMPLETE, true);
    return;
  }

  // Path A and B are independent — failure of one should not block the other
  let localSuccess = true;
  let remoteSuccess = true;

  // Path A: localStorage data exists
  if (hasLocalStorageData) {
    try {
      await migrateFromLocalStorage(indexedDBStorage, rawData, attemptNumber);
    } catch (error) {
      localSuccess = false;
      // Telemetry already reported inside migrateFromLocalStorage
    }
  }

  // Path B: remote API data exists
  if (hasRemoteData) {
    try {
      await migrateFromRemoteStorage(indexedDBStorage, attemptNumber);
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
  indexedDBStorage: RichHistoryIndexedDBStorage,
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
  let duplicatesSkipped = 0;

  try {
    const db = await indexedDBStorage.getDB();

    // Batch-write valid entries
    const tx = db.transaction('queries', 'readwrite');
    for (const entry of validEntries) {
      const datasource = getDataSourceSrv().getInstanceSettings(entry.datasourceName);
      const datasourceUid = datasource?.uid || '';

      const id = crypto.randomUUID();

      await tx.store.put({
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
    await tx.done;

    duplicatesSkipped = itemCount - validEntries.length;

    // Migrate settings
    await migrateSettings(indexedDBStorage);

    // Do NOT delete localStorage key — preserved for rollback

    const durationMs = Date.now() - startTime;

    reportInteraction('grafana_query_history_migration_completed', {
      source: 'localStorage',
      itemCount,
      itemsWritten,
      durationMs,
      duplicatesSkipped,
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
  indexedDBStorage: RichHistoryIndexedDBStorage,
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

    // Write to IndexedDB with dedup
    const db = await indexedDBStorage.getDB();
    const tx = db.transaction('queries', 'readwrite');

    for (const dto of allItems) {
      const createdAtMs = dto.createdAt * 1000;

      // Dedup: check if an entry with similar createdAt and same datasource already exists
      const range = IDBKeyRange.bound(createdAtMs - 1000, createdAtMs + 1000);
      const existing = await tx.store.index('by-createdAt').openCursor(range);
      if (existing && existing.value.datasourceUid === dto.datasourceUid) {
        duplicatesSkipped++;
        continue;
      }

      // Look up datasource name from uid
      const dsSettings = getDataSourceSrv().getInstanceSettings({ uid: dto.datasourceUid });
      const datasourceName = dsSettings?.name || '';

      await tx.store.put({
        id: crypto.randomUUID(),
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

async function migrateSettings(indexedDBStorage: RichHistoryIndexedDBStorage): Promise<void> {
  const rawRetention = store.getObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 7);
  const retentionPeriod = typeof rawRetention === 'number' ? rawRetention : 7;
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
