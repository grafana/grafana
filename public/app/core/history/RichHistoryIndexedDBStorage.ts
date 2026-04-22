import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isEqual, omit } from 'lodash';

import { type DataQuery } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import {
  type RichHistorySearchBackendFilters,
  type RichHistorySettings,
  SortOrder,
} from 'app/core/utils/richHistoryTypes';
import type { RichHistoryQuery } from 'app/types/explore';

import {
  type default as RichHistoryStorage,
  type RichHistoryResults,
  RichHistoryServiceError,
  type RichHistoryStorageWarningDetails,
} from './RichHistoryStorage';
import { migrateToIndexedDB } from './indexedDBMigration';

const DB_NAME = 'grafana-query-history';
const DB_VERSION = 1;
const QUERIES_STORE = 'queries';
const SETTINGS_STORE = 'settings';
const METADATA_STORE = 'metadata';

const ITEM_COUNT_WARNING_THRESHOLD = 50_000;
const MS_PER_DAY = 86_400_000;

const DEFAULT_SETTINGS: RichHistorySettings = {
  retentionPeriod: 7,
  starredTabAsFirstTab: false,
  activeDatasourcesOnly: false,
  lastUsedDatasourceFilters: [],
};

/**
 * Schema stored in IndexedDB. Booleans are stored as 0/1 for indexing.
 */
interface StoredQuery {
  id: string;
  datasourceUid: string;
  datasourceName: string;
  createdAt: number;
  starred: 0 | 1;
  comment: string;
  queries: DataQuery[];
}

interface QueryHistoryDBSchema extends DBSchema {
  [QUERIES_STORE]: {
    key: string;
    value: StoredQuery;
    indexes: {
      'by-createdAt': number;
      'by-datasourceUid': string;
      'by-starred': number;
      'by-starred-createdAt': [number, number];
      'by-datasourceUid-createdAt': [string, number];
    };
  };
  [SETTINGS_STORE]: {
    key: string;
    value: unknown;
  };
  [METADATA_STORE]: {
    key: string;
    value: unknown;
  };
}

function toStoredQuery(query: RichHistoryQuery): StoredQuery {
  return {
    id: query.id,
    datasourceUid: query.datasourceUid,
    datasourceName: query.datasourceName,
    createdAt: query.createdAt,
    starred: query.starred ? 1 : 0,
    comment: query.comment,
    queries: query.queries,
  };
}

function fromStoredQuery(stored: StoredQuery): RichHistoryQuery {
  return {
    id: stored.id,
    datasourceUid: stored.datasourceUid,
    datasourceName: stored.datasourceName,
    createdAt: stored.createdAt,
    starred: stored.starred === 1,
    comment: stored.comment,
    queries: stored.queries,
  };
}

function matchesSearchFilter(query: RichHistoryQuery, searchFilter: string): boolean {
  if (!searchFilter) {
    return true;
  }

  if (query.comment.includes(searchFilter)) {
    return true;
  }

  return query.queries.some((q) =>
    Object.values(omit(q, ['datasource', 'key', 'refId', 'hide', 'queryType'])).some((value) =>
      value?.toString().includes(searchFilter)
    )
  );
}

/** Exposed only for migration — not part of the RichHistoryStorage contract. */
export interface IndexedDBMigrationAccess {
  getDB(): Promise<IDBPDatabase<QueryHistoryDBSchema>>;
  getMetadata(key: string): Promise<unknown>;
  setMetadata(key: string, value: unknown): Promise<void>;
  updateSettings(settings: RichHistorySettings): Promise<void>;
}

export default class RichHistoryIndexedDBStorage implements RichHistoryStorage, IndexedDBMigrationAccess {
  private static readonly CLEANUP_INTERVAL_MS = 3_600_000; // 1 hour

  private dbPromise: Promise<IDBPDatabase<QueryHistoryDBSchema>>;
  private migrationPromise: Promise<void> | undefined;
  private lastCleanupTime = 0;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private ensureMigrated(): Promise<void> {
    if (!this.migrationPromise) {
      this.migrationPromise = migrateToIndexedDB(this).catch((error) => {
        // Log but don't block — user can still use storage
        console.error('Query history migration failed:', error);
        // Reset so it retries on next access
        this.migrationPromise = undefined;
      });
    }
    return this.migrationPromise;
  }

  private async initDB(): Promise<IDBPDatabase<QueryHistoryDBSchema>> {
    return openDB<QueryHistoryDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Queries store
        const queryStore = db.createObjectStore(QUERIES_STORE, { keyPath: 'id' });
        queryStore.createIndex('by-createdAt', 'createdAt');
        queryStore.createIndex('by-datasourceUid', 'datasourceUid');
        queryStore.createIndex('by-starred', 'starred');
        queryStore.createIndex('by-starred-createdAt', ['starred', 'createdAt']);
        queryStore.createIndex('by-datasourceUid-createdAt', ['datasourceUid', 'createdAt']);

        // Settings store
        db.createObjectStore(SETTINGS_STORE);

        // Metadata store
        db.createObjectStore(METADATA_STORE);
      },
    });
  }

  /** Expose db for migration use */
  getDB(): Promise<IDBPDatabase<QueryHistoryDBSchema>> {
    return this.dbPromise;
  }

  /** Read from metadata store */
  async getMetadata(key: string): Promise<unknown> {
    const db = await this.dbPromise;
    return db.get(METADATA_STORE, key);
  }

  /** Write to metadata store */
  async setMetadata(key: string, value: unknown): Promise<void> {
    const db = await this.dbPromise;
    await db.put(METADATA_STORE, value, key);
  }

  async addToRichHistory(
    newRichHistoryQuery: Omit<RichHistoryQuery, 'id' | 'createdAt'>
  ): Promise<{ warning?: RichHistoryStorageWarningDetails; richHistoryQuery: RichHistoryQuery }> {
    const db = await this.dbPromise;

    // Dedup check: only compares against the most recent entry to prevent
    // consecutive duplicate submissions. This matches the localStorage
    // implementation. Non-consecutive duplicates (A, B, A) are allowed.
    // Uses a single readwrite transaction for both check and write to avoid TOCTOU race.
    const tx = db.transaction(QUERIES_STORE, 'readwrite');
    const store = tx.objectStore(QUERIES_STORE);
    const index = store.index('by-createdAt');
    const cursor = await index.openCursor(null, 'prev');

    if (cursor) {
      const lastEntry = cursor.value;
      const newQueriesToCompare = newRichHistoryQuery.queries.map((q) => omit(q, ['key', 'refId']));
      const lastQueriesToCompare = lastEntry.queries.map((q) => omit(q, ['key', 'refId']));

      if (isEqual(newQueriesToCompare, lastQueriesToCompare)) {
        // Don't await tx.done — transaction auto-aborts when we throw
        const error = new Error('Entry already exists');
        error.name = RichHistoryServiceError.DuplicatedEntry;
        throw error;
      }
    }

    const now = Date.now();
    const richHistoryQuery: RichHistoryQuery = {
      id: crypto.randomUUID(),
      createdAt: now,
      ...newRichHistoryQuery,
    };

    await store.put(toStoredQuery(richHistoryQuery));
    await tx.done;

    // Check total count for warning (separate transaction, after write committed)
    const count = await db.count(QUERIES_STORE);
    if (count >= ITEM_COUNT_WARNING_THRESHOLD) {
      reportInteraction('grafana_query_history_item_count_warning', { itemCount: count });
    }

    return { richHistoryQuery };
  }

  async getRichHistory(filters: RichHistorySearchBackendFilters): Promise<RichHistoryResults> {
    await this.ensureMigrated();
    const db = await this.dbPromise;

    await this.maybeRunRetentionCleanup(db);

    // 1. Index-based retrieval — narrow at the DB level
    let storedResults: StoredQuery[];

    if (filters.starred && filters.from !== undefined && filters.to !== undefined) {
      // Starred tab: compound index [starred=1, createdAt] with time range
      const index = db.transaction(QUERIES_STORE).objectStore(QUERIES_STORE).index('by-starred-createdAt');
      const range = IDBKeyRange.bound([1, filters.from], [1, filters.to], true, true);
      storedResults = await index.getAll(range);
    } else if (filters.from !== undefined && filters.to !== undefined) {
      // Queries tab: time range only, no starred filter
      const index = db.transaction(QUERIES_STORE).objectStore(QUERIES_STORE).index('by-createdAt');
      const range = IDBKeyRange.bound(filters.from, filters.to, true, true);
      storedResults = await index.getAll(range);
    } else {
      // No time range (rare: query library fetchQueryHistory)
      storedResults = await db.getAll(QUERIES_STORE);
    }

    // 2. JS filters on the narrowed set (datasource name, text search)
    let results = storedResults.map(fromStoredQuery);

    if (filters.datasourceFilters.length > 0) {
      results = results.filter((q) => filters.datasourceFilters.includes(q.datasourceName));
    }

    if (filters.search) {
      results = results.filter((q) => matchesSearchFilter(q, filters.search));
    }

    // 3. Sort
    results = this.sortQueries(results, filters.sortOrder);

    // TODO(v14): Re-enable localStorage cleanup once `queryHistoryLocalOnly` and
    // the remote API are retired. localStorage is preserved as the rollback path
    // while the flag still gates IndexedDB usage.

    return { richHistory: results, total: results.length };
  }

  async deleteAll(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(QUERIES_STORE);
  }

  async deleteRichHistory(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(QUERIES_STORE, id);
  }

  async updateStarred(id: string, starred: boolean): Promise<RichHistoryQuery> {
    const db = await this.dbPromise;
    const tx = db.transaction(QUERIES_STORE, 'readwrite');
    const store = tx.objectStore(QUERIES_STORE);
    const entry = await store.get(id);

    if (!entry) {
      throw new Error('Rich history item not found.');
    }

    entry.starred = starred ? 1 : 0;
    await store.put(entry);
    await tx.done;

    return fromStoredQuery(entry);
  }

  async updateComment(id: string, comment: string | undefined): Promise<RichHistoryQuery> {
    const db = await this.dbPromise;
    const tx = db.transaction(QUERIES_STORE, 'readwrite');
    const store = tx.objectStore(QUERIES_STORE);
    const entry = await store.get(id);

    if (!entry) {
      throw new Error('Rich history item not found.');
    }

    entry.comment = comment ?? '';
    await store.put(entry);
    await tx.done;

    return fromStoredQuery(entry);
  }

  async getSettings(): Promise<RichHistorySettings> {
    const db = await this.dbPromise;
    const [retentionPeriod, starredTabAsFirstTab, activeDatasourcesOnly, lastUsedDatasourceFilters] = await Promise.all(
      [
        db.get(SETTINGS_STORE, 'retentionPeriod'),
        db.get(SETTINGS_STORE, 'starredTabAsFirstTab'),
        db.get(SETTINGS_STORE, 'activeDatasourcesOnly'),
        db.get(SETTINGS_STORE, 'lastUsedDatasourceFilters'),
      ]
    );

    return {
      retentionPeriod: typeof retentionPeriod === 'number' ? retentionPeriod : DEFAULT_SETTINGS.retentionPeriod,
      starredTabAsFirstTab:
        typeof starredTabAsFirstTab === 'boolean' ? starredTabAsFirstTab : DEFAULT_SETTINGS.starredTabAsFirstTab,
      activeDatasourcesOnly:
        typeof activeDatasourcesOnly === 'boolean' ? activeDatasourcesOnly : DEFAULT_SETTINGS.activeDatasourcesOnly,
      lastUsedDatasourceFilters: Array.isArray(lastUsedDatasourceFilters)
        ? lastUsedDatasourceFilters
        : DEFAULT_SETTINGS.lastUsedDatasourceFilters,
    };
  }

  async updateSettings(settings: RichHistorySettings): Promise<void> {
    const db = await this.dbPromise;
    await Promise.all([
      db.put(SETTINGS_STORE, settings.retentionPeriod, 'retentionPeriod'),
      db.put(SETTINGS_STORE, settings.starredTabAsFirstTab, 'starredTabAsFirstTab'),
      db.put(SETTINGS_STORE, settings.activeDatasourcesOnly, 'activeDatasourcesOnly'),
      db.put(SETTINGS_STORE, settings.lastUsedDatasourceFilters ?? [], 'lastUsedDatasourceFilters'),
    ]);
  }

  private async maybeRunRetentionCleanup(db: IDBPDatabase<QueryHistoryDBSchema>): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupTime < RichHistoryIndexedDBStorage.CLEANUP_INTERVAL_MS) {
      return;
    }
    this.lastCleanupTime = now;
    await this.runRetentionCleanup(db);
  }

  private async runRetentionCleanup(db: IDBPDatabase<QueryHistoryDBSchema>): Promise<void> {
    const settings = await this.getSettings();
    const retentionBoundary = Date.now() - settings.retentionPeriod * MS_PER_DAY;

    const tx = db.transaction(QUERIES_STORE, 'readwrite');
    const index = tx.objectStore(QUERIES_STORE).index('by-createdAt');
    const range = IDBKeyRange.upperBound(retentionBoundary);

    let cursor = await index.openCursor(range);
    while (cursor) {
      // Only delete non-starred entries
      if (cursor.value.starred === 0) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  }

  // NOTE: DatasourceAZ/ZA sort labels are historically inverted in the existing
  // localStorage implementation (richHistoryLocalStorageUtils.ts). We preserve
  // this behavior for backward compatibility with the UI.
  private sortQueries(queries: RichHistoryQuery[], sortOrder: SortOrder): RichHistoryQuery[] {
    switch (sortOrder) {
      case SortOrder.Ascending:
        return queries.sort((a, b) => a.createdAt - b.createdAt);
      case SortOrder.Descending:
        return queries.sort((a, b) => b.createdAt - a.createdAt);
      case SortOrder.DatasourceAZ:
        return queries.sort((a, b) =>
          a.datasourceName < b.datasourceName ? 1 : a.datasourceName > b.datasourceName ? -1 : 0
        );
      case SortOrder.DatasourceZA:
        return queries.sort((a, b) =>
          a.datasourceName < b.datasourceName ? -1 : a.datasourceName > b.datasourceName ? 1 : 0
        );
      default:
        return queries;
    }
  }
}
