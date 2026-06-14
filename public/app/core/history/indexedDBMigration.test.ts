import 'fake-indexeddb/auto';

import { of } from 'rxjs';

import { type DataQuery, store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { SortOrder } from 'app/core/utils/richHistoryTypes';

import RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';
import { RICH_HISTORY_KEY, type RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';
import { migrateToIndexedDB } from './indexedDBMigration';
import { RICH_HISTORY_SETTING_KEYS } from './richHistoryLocalStorageUtils';

interface MockQuery extends DataQuery {
  expr?: string;
}

const mockFetch = jest.fn();

const mockConfig = { queryHistoryEnabled: false };

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getBackendSrv: () => ({ fetch: mockFetch }),
  getDataSourceSrv: () => ({
    getInstanceSettings: (nameOrUid: string | { uid: string }) => {
      const datasources: Record<string, { uid: string; name: string }> = {
        Prometheus: { uid: 'ds-prom', name: 'Prometheus' },
        Loki: { uid: 'ds-loki', name: 'Loki' },
      };
      if (typeof nameOrUid === 'string') {
        return datasources[nameOrUid];
      }
      return Object.values(datasources).find((ds) => ds.uid === nameOrUid.uid);
    },
  }),
  get config() {
    return mockConfig;
  },
}));

// Use recent timestamps so retention cleanup does not remove them
const NOW = new Date('2025-01-15T12:00:00Z').getTime();
const ONE_HOUR = 3_600_000;

const validEntry1: RichHistoryLocalStorageDTO = {
  ts: NOW - ONE_HOUR,
  datasourceName: 'Prometheus',
  starred: true,
  comment: 'my query',
  queries: [{ refId: 'A', expr: 'up' } as MockQuery],
};

const validEntry2: RichHistoryLocalStorageDTO = {
  ts: NOW - ONE_HOUR * 2,
  datasourceName: 'Loki',
  starred: false,
  comment: '',
  queries: [{ refId: 'A', expr: '{app="test"}' } as MockQuery],
};

describe('migrateToIndexedDB', () => {
  let indexedDBStorage: RichHistoryIndexedDBStorage;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(async () => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);

    // Clear localStorage
    store.delete(RICH_HISTORY_KEY);
    store.delete(RICH_HISTORY_SETTING_KEYS.retentionPeriod);
    store.delete(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab);
    store.delete(RICH_HISTORY_SETTING_KEYS.activeDatasourcesOnly);
    store.delete(RICH_HISTORY_SETTING_KEYS.legacyActiveDatasourceOnly);
    store.delete(RICH_HISTORY_SETTING_KEYS.datasourceFilters);
    store.delete('grafana.debug.resetQueryHistoryMigration');

    // Fresh IndexedDB storage and clear all stores
    indexedDBStorage = new RichHistoryIndexedDBStorage();
    const db = await indexedDBStorage.getDB();
    await db.clear('queries');
    await db.clear('settings');
    await db.clear('metadata');

    (reportInteraction as jest.Mock).mockReset();
    mockFetch.mockReset();
    mockConfig.queryHistoryEnabled = false;
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  function queryFilters() {
    return {
      search: '',
      sortOrder: SortOrder.Ascending,
      datasourceFilters: [],
      from: 0,
      to: NOW + 86_400_000,
      starred: false,
    };
  }

  it('should migrate localStorage entries to IndexedDB correctly', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1, validEntry2]);

    await migrateToIndexedDB(indexedDBStorage);

    const result = await indexedDBStorage.getRichHistory(queryFilters());

    expect(result.total).toBe(2);

    const sorted = result.richHistory.sort((a, b) => a.createdAt - b.createdAt);
    expect(sorted[0]).toMatchObject({
      createdAt: validEntry2.ts,
      datasourceName: 'Loki',
      datasourceUid: 'ds-loki',
      starred: false,
      comment: '',
    });
    expect(sorted[1]).toMatchObject({
      createdAt: validEntry1.ts,
      datasourceName: 'Prometheus',
      datasourceUid: 'ds-prom',
      starred: true,
      comment: 'my query',
    });
  });

  it('should migrate settings from localStorage to IndexedDB', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);
    store.setObject(RICH_HISTORY_SETTING_KEYS.retentionPeriod, 14);
    store.set(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, 'true');
    store.setObject(RICH_HISTORY_SETTING_KEYS.activeDatasourcesOnly, true);

    await migrateToIndexedDB(indexedDBStorage);

    const settings = await indexedDBStorage.getSettings();
    expect(settings.retentionPeriod).toBe(14);
    expect(settings.starredTabAsFirstTab).toBe(true);
    expect(settings.activeDatasourcesOnly).toBe(true);
  });

  it('should use legacy activeDatasourceOnly key when new key is not set', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);
    store.setObject(RICH_HISTORY_SETTING_KEYS.legacyActiveDatasourceOnly, true);

    await migrateToIndexedDB(indexedDBStorage);

    const settings = await indexedDBStorage.getSettings();
    expect(settings.activeDatasourcesOnly).toBe(true);
  });

  it('should NOT delete localStorage key after migration', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);

    await migrateToIndexedDB(indexedDBStorage);

    const remaining = store.getObject(RICH_HISTORY_KEY, []);
    expect(remaining).toHaveLength(1);
  });

  it('should skip malformed entries gracefully', async () => {
    const malformed = [
      validEntry1,
      { ts: 'not a number', datasourceName: 'Prometheus', starred: true, comment: '', queries: [] }, // bad ts
      { ts: 123, starred: true, comment: '', queries: [] }, // missing datasourceName
      { ts: 456, datasourceName: 'Loki', starred: 'yes', comment: '', queries: [] }, // bad starred
      validEntry2,
    ];
    store.setObject(RICH_HISTORY_KEY, malformed);

    await migrateToIndexedDB(indexedDBStorage);

    const result = await indexedDBStorage.getRichHistory(queryFilters());

    expect(result.total).toBe(2);
  });

  it('should emit started and completed telemetry events', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1, validEntry2]);

    await migrateToIndexedDB(indexedDBStorage);

    expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_migration_started', {
      source: 'localStorage',
      itemCount: 2,
    });

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_query_history_migration_completed',
      expect.objectContaining({
        source: 'localStorage',
        itemCount: 2,
        itemsWritten: 2,
        invalidEntriesSkipped: 0,
      })
    );
  });

  it('should not re-run if migrationComplete is already true (idempotency)', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);

    // Run once
    await migrateToIndexedDB(indexedDBStorage);
    (reportInteraction as jest.Mock).mockReset();

    // Run again — should be a no-op
    await migrateToIndexedDB(indexedDBStorage);

    expect(reportInteraction).not.toHaveBeenCalled();

    const result = await indexedDBStorage.getRichHistory(queryFilters());

    // Should still only have the original entries, not duplicated
    expect(result.total).toBe(1);
  });

  it('does not duplicate entries when two migrations run concurrently', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1, validEntry2]);

    // Simulates two tabs racing the one-time migration (e.g. browser session restore).
    await Promise.all([migrateToIndexedDB(indexedDBStorage), migrateToIndexedDB(indexedDBStorage)]);

    const result = await indexedDBStorage.getRichHistory(queryFilters());
    expect(result.total).toBe(2);
  });

  it('does not duplicate entries when a retry follows a settings write failure', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1, validEntry2]);
    jest.spyOn(indexedDBStorage, 'updateSettings').mockRejectedValueOnce(new Error('settings write failed'));

    // Attempt 1: entry writes commit, settings write fails, migration stays incomplete.
    await migrateToIndexedDB(indexedDBStorage);
    expect(await indexedDBStorage.getMetadata('migrationComplete')).not.toBe(true);

    // Attempt 2: must not re-import entries, must retry settings, must complete.
    await migrateToIndexedDB(indexedDBStorage);

    const result = await indexedDBStorage.getRichHistory(queryFilters());
    expect(result.total).toBe(2);
    expect(await indexedDBStorage.getMetadata('migrationComplete')).toBe(true);
  });

  it('serializes migration through the Web Locks API when available', async () => {
    const request = jest.fn(async (_name: string, cb: () => Promise<void>) => cb());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    try {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);
      await migrateToIndexedDB(indexedDBStorage);

      expect(request).toHaveBeenCalledWith('grafana-query-history-migration', expect.any(Function));
      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(1);
    } finally {
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    }
  });

  describe('reset escape hatch', () => {
    const RESET_KEY = 'grafana.debug.resetQueryHistoryMigration';

    it('should re-run migration when reset key is present and clear the key', async () => {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);

      // First run completes migration
      await migrateToIndexedDB(indexedDBStorage);
      expect(await indexedDBStorage.getMetadata('migrationComplete')).toBe(true);
      (reportInteraction as jest.Mock).mockReset();

      // Trigger reset, then run again
      store.set(RESET_KEY, '1');
      await migrateToIndexedDB(indexedDBStorage);

      // Reset telemetry emitted
      expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_migration_reset', {});

      // Reset key consumed
      expect(store.exists(RESET_KEY)).toBe(false);

      // Markers reset and migration re-ran
      expect(await indexedDBStorage.getMetadata('migrationComplete')).toBe(true);
      expect(await indexedDBStorage.getMetadata('migrationAttempts')).toBe(1);
      // Dedup prevents duplicates after re-run
      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(1);
    });

    it('should be a no-op when reset key is absent', async () => {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);
      await migrateToIndexedDB(indexedDBStorage);
      (reportInteraction as jest.Mock).mockReset();

      // No reset key set → second run is the existing idempotent no-op
      await migrateToIndexedDB(indexedDBStorage);

      expect(reportInteraction).not.toHaveBeenCalledWith('grafana_query_history_migration_reset', expect.anything());
    });
  });

  it('should emit failure telemetry and NOT set migrationComplete on error', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);

    // Spy on getDB so it fails when migration tries to write queries
    const originalGetDB = indexedDBStorage.getDB.bind(indexedDBStorage);
    jest.spyOn(indexedDBStorage, 'getDB').mockRejectedValue(new Error('IndexedDB unavailable'));

    // Migration no longer throws on partial failure — it resolves but doesn't mark complete
    await migrateToIndexedDB(indexedDBStorage);

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_query_history_migration_failed',
      expect.objectContaining({
        source: 'localStorage',
        error: 'IndexedDB unavailable',
        attemptNumber: 1,
        itemCount: 1,
        itemsWritten: 0,
      })
    );

    // migrationComplete should NOT be set — use original getDB to verify
    jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(originalGetDB);
    const complete = await indexedDBStorage.getMetadata('migrationComplete');
    expect(complete).not.toBe(true);
  });

  it('should set migrationComplete when no data exists in localStorage (Path C)', async () => {
    // No localStorage data at all
    await migrateToIndexedDB(indexedDBStorage);

    const complete = await indexedDBStorage.getMetadata('migrationComplete');
    expect(complete).toBe(true);

    // No telemetry events should be emitted for empty migration
    expect(reportInteraction).not.toHaveBeenCalled();
  });

  it('should handle entries with unknown datasource by setting empty uid', async () => {
    const entryWithUnknownDs: RichHistoryLocalStorageDTO = {
      ts: NOW - ONE_HOUR,
      datasourceName: 'UnknownDatasource',
      starred: true, // starred so retention cleanup won't remove it
      comment: '',
      queries: [{ refId: 'A' } as MockQuery],
    };
    store.setObject(RICH_HISTORY_KEY, [entryWithUnknownDs]);

    await migrateToIndexedDB(indexedDBStorage);

    const result = await indexedDBStorage.getRichHistory(queryFilters());

    expect(result.total).toBe(1);
    expect(result.richHistory[0].datasourceUid).toBe('');
    expect(result.richHistory[0].datasourceName).toBe('UnknownDatasource');
  });

  it('should increment migration attempts on each call', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);

    // Make getDB throw so migration fails in the try block
    const originalGetDB = indexedDBStorage.getDB.bind(indexedDBStorage);
    jest.spyOn(indexedDBStorage, 'getDB').mockRejectedValue(new Error('fail'));

    // Migration no longer throws — it resolves but doesn't mark complete
    await migrateToIndexedDB(indexedDBStorage);
    await migrateToIndexedDB(indexedDBStorage);

    // Restore to read metadata
    jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(originalGetDB);
    const attempts = await indexedDBStorage.getMetadata('migrationAttempts');
    expect(attempts).toBe(2);
  });

  describe('Path B: remote storage migration', () => {
    const remoteEntry1 = {
      uid: 'remote-1',
      createdAt: (NOW - ONE_HOUR * 3) / 1000, // seconds
      datasourceUid: 'ds-prom',
      starred: true,
      comment: 'remote query 1',
      queries: [{ refId: 'A', expr: 'rate(http_requests_total[5m])' }],
    };

    const remoteEntry2 = {
      uid: 'remote-2',
      createdAt: (NOW - ONE_HOUR * 4) / 1000, // seconds
      datasourceUid: 'ds-loki',
      starred: false,
      comment: '',
      queries: [{ refId: 'A', expr: '{job="grafana"}' }],
    };

    function mockRemoteResponse(items: Array<typeof remoteEntry1>, totalCount?: number) {
      return of({
        data: {
          result: {
            queryHistory: items,
            totalCount: totalCount ?? items.length,
          },
        },
      });
    }

    it('should pull remote data and store it correctly with createdAt converted from seconds to ms', async () => {
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry1, remoteEntry2]));

      await migrateToIndexedDB(indexedDBStorage);

      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(2);

      const sorted = result.richHistory.sort((a, b) => a.createdAt - b.createdAt);
      expect(sorted[0]).toMatchObject({
        createdAt: remoteEntry2.createdAt * 1000,
        datasourceName: 'Loki',
        datasourceUid: 'ds-loki',
        starred: false,
        comment: '',
      });
      expect(sorted[1]).toMatchObject({
        createdAt: remoteEntry1.createdAt * 1000,
        datasourceName: 'Prometheus',
        datasourceUid: 'ds-prom',
        starred: true,
        comment: 'remote query 1',
      });
    });

    it('should dedup remote entries that overlap with Path A localStorage entries', async () => {
      // First, put localStorage data that has the same timestamp as a remote entry
      const localEntryMatchingRemote: RichHistoryLocalStorageDTO = {
        ts: remoteEntry1.createdAt * 1000, // same time as remote entry 1
        datasourceName: 'Prometheus',
        starred: true,
        comment: 'local version',
        queries: [{ refId: 'A', expr: 'up' } as MockQuery],
      };
      store.setObject(RICH_HISTORY_KEY, [localEntryMatchingRemote]);
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry1, remoteEntry2]));

      await migrateToIndexedDB(indexedDBStorage);

      const result = await indexedDBStorage.getRichHistory(queryFilters());
      // Should have 2: the localStorage entry + remoteEntry2 (remoteEntry1 deduped)
      expect(result.total).toBe(2);
    });

    it('should emit started and completed telemetry for remote migration', async () => {
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry1]));

      await migrateToIndexedDB(indexedDBStorage);

      expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_migration_started', {
        source: 'remote',
        itemCount: 1,
      });
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_completed',
        expect.objectContaining({
          source: 'remote',
          itemCount: 1,
          itemsWritten: 1,
          duplicatesSkipped: 0,
        })
      );
    });

    it('should NOT run remote migration when queryHistoryEnabled is false', async () => {
      mockConfig.queryHistoryEnabled = false;
      // No localStorage data either — should be Path C
      await migrateToIndexedDB(indexedDBStorage);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(reportInteraction).not.toHaveBeenCalledWith(
        'grafana_query_history_migration_started',
        expect.objectContaining({ source: 'remote' })
      );
    });

    it('should paginate through multiple pages of remote data', async () => {
      mockConfig.queryHistoryEnabled = true;

      // Page 1: returns 2 items, totalCount indicates 3
      mockFetch.mockReturnValueOnce(mockRemoteResponse([remoteEntry1, remoteEntry2], 3)).mockReturnValueOnce(
        mockRemoteResponse(
          [
            {
              uid: 'remote-3',
              createdAt: (NOW - ONE_HOUR * 5) / 1000,
              datasourceUid: 'ds-prom',
              starred: false,
              comment: 'page 2 query',
              queries: [{ refId: 'A', expr: 'node_cpu_seconds_total' }],
            },
          ],
          3
        )
      );

      await migrateToIndexedDB(indexedDBStorage);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(3);
    });

    it('should emit failure telemetry for remote migration and NOT set migrationComplete', async () => {
      mockConfig.queryHistoryEnabled = true;

      // Make getDB fail when remote migration tries to use it
      const originalGetDB = indexedDBStorage.getDB.bind(indexedDBStorage);
      jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(() => {
        return Promise.reject(new Error('IndexedDB write failed'));
      });

      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry1]));

      // Migration no longer throws on partial failure — it resolves but doesn't mark complete
      await migrateToIndexedDB(indexedDBStorage);

      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_failed',
        expect.objectContaining({
          source: 'remote',
          error: 'IndexedDB write failed',
        })
      );

      // migrationComplete should NOT be set
      jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(originalGetDB);
      const complete = await indexedDBStorage.getMetadata('migrationComplete');
      expect(complete).not.toBe(true);
    });

    it('should not dedup remote entries with same timestamp but different datasourceUid', async () => {
      mockConfig.queryHistoryEnabled = true;

      const sameTimestamp = (NOW - ONE_HOUR * 3) / 1000;
      const entryA = {
        uid: 'remote-same-ts-1',
        createdAt: sameTimestamp,
        datasourceUid: 'ds-prom',
        starred: false,
        comment: 'prom query',
        queries: [{ refId: 'A', expr: 'up' }],
      };
      const entryB = {
        uid: 'remote-same-ts-2',
        createdAt: sameTimestamp,
        datasourceUid: 'ds-loki',
        starred: false,
        comment: 'loki query',
        queries: [{ refId: 'A', expr: '{app="test"}' }],
      };

      mockFetch.mockReturnValue(mockRemoteResponse([entryA, entryB]));

      await migrateToIndexedDB(indexedDBStorage);

      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(2);
    });

    it('dedups a remote entry when a different-datasource entry appears earlier in the window', async () => {
      const T = NOW - ONE_HOUR * 3;
      // Path A seeds two entries 1s apart; the remote entry duplicates the SECOND one.
      // The by-createdAt cursor over the ±5s window hits the Loki entry first, so a
      // first-record-only check misses the Prometheus duplicate.
      store.setObject(RICH_HISTORY_KEY, [
        {
          ts: T,
          datasourceName: 'Loki',
          starred: false,
          comment: '',
          queries: [{ refId: 'A', expr: '{app="x"}' } as MockQuery],
        },
        {
          ts: T + 1000,
          datasourceName: 'Prometheus',
          starred: false,
          comment: 'prom',
          queries: [{ refId: 'A', expr: 'up' } as MockQuery],
        },
      ]);
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(
        mockRemoteResponse([
          {
            uid: 'r-dup',
            createdAt: (T + 1000) / 1000,
            datasourceUid: 'ds-prom',
            starred: false,
            comment: 'prom',
            queries: [{ refId: 'A', expr: 'up' }],
          },
        ])
      );

      await migrateToIndexedDB(indexedDBStorage);

      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(2);
    });

    it('should run Path B even when Path A fails', async () => {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry2]));

      // Make getDB fail only on the first call (Path A), then succeed (Path B)
      const originalGetDB = indexedDBStorage.getDB.bind(indexedDBStorage);
      let getDBCallCount = 0;
      jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(() => {
        getDBCallCount++;
        if (getDBCallCount === 1) {
          return Promise.reject(new Error('Path A failure'));
        }
        return originalGetDB();
      });

      await migrateToIndexedDB(indexedDBStorage);

      // Path A should have failed
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_failed',
        expect.objectContaining({ source: 'localStorage' })
      );

      // Path B should have succeeded
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_completed',
        expect.objectContaining({ source: 'remote' })
      );

      // migrationComplete should NOT be set (partial failure)
      jest.spyOn(indexedDBStorage, 'getDB').mockImplementation(originalGetDB);
      const complete = await indexedDBStorage.getMetadata('migrationComplete');
      expect(complete).not.toBe(true);
    });

    it('should not duplicate localStorage entries when Path A succeeds but Path B fails on retry', async () => {
      store.setObject(RICH_HISTORY_KEY, [validEntry1, validEntry2]);
      mockConfig.queryHistoryEnabled = true;

      // First attempt: Path A succeeds, Path B fails (remote fetch throws)
      mockFetch.mockImplementation(() => {
        throw new Error('network error');
      });

      await migrateToIndexedDB(indexedDBStorage);

      // Path A completed, Path B failed — migration not marked complete
      const complete1 = await indexedDBStorage.getMetadata('migrationComplete');
      expect(complete1).not.toBe(true);

      // But localMigrationComplete should be set
      const localDone = await indexedDBStorage.getMetadata('localMigrationComplete');
      expect(localDone).toBe(true);

      const result1 = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result1.total).toBe(2);

      // Second attempt: Path B now succeeds
      (reportInteraction as jest.Mock).mockReset();
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry1]));

      await migrateToIndexedDB(indexedDBStorage);

      // Path A should NOT have re-run (no localStorage telemetry)
      expect(reportInteraction).not.toHaveBeenCalledWith(
        'grafana_query_history_migration_started',
        expect.objectContaining({ source: 'localStorage' })
      );

      // Path B should have run and succeeded
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_completed',
        expect.objectContaining({ source: 'remote' })
      );

      // Total entries: 2 from localStorage + 1 from remote (no duplicates)
      const result2 = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result2.total).toBe(3);
    });

    it('should run both Path A and Path B when both sources have data', async () => {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);
      mockConfig.queryHistoryEnabled = true;
      mockFetch.mockReturnValue(mockRemoteResponse([remoteEntry2]));

      await migrateToIndexedDB(indexedDBStorage);

      // Should have both localStorage and remote entries
      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(2);

      // Both sources should have telemetry
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_started',
        expect.objectContaining({ source: 'localStorage' })
      );
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_query_history_migration_started',
        expect.objectContaining({ source: 'remote' })
      );
    });
  });

  it('should migrate datasource filters from SelectableValue format', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);
    store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, [{ value: 'Prometheus' }, { value: 'Loki' }]);

    await migrateToIndexedDB(indexedDBStorage);

    const settings = await indexedDBStorage.getSettings();
    expect(settings.lastUsedDatasourceFilters).toEqual(['Prometheus', 'Loki']);
  });

  it('should handle malformed datasource filters gracefully', async () => {
    store.setObject(RICH_HISTORY_KEY, [validEntry1]);
    store.setObject(RICH_HISTORY_SETTING_KEYS.datasourceFilters, [
      { value: 'Prometheus' },
      { value: undefined },
      { value: '' },
      {},
    ]);

    await migrateToIndexedDB(indexedDBStorage);

    const settings = await indexedDBStorage.getSettings();
    expect(settings.lastUsedDatasourceFilters).toEqual(['Prometheus']);
  });

  it('should abandon migration after max attempts: warn, do not mark complete, do not over-increment', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      store.setObject(RICH_HISTORY_KEY, [validEntry1]);

      // Set attempts to the cap so the next call abandons.
      await indexedDBStorage.setMetadata('migrationAttempts', 3);

      await migrateToIndexedDB(indexedDBStorage);

      // Should have fired abandoned telemetry with the capped attempt count.
      expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_migration_abandoned', {
        attempts: 3,
      });

      // Should warn (not a UI notification).
      expect(warnSpy).toHaveBeenCalled();

      // Should NOT be marked complete — leaves recovery open for a future fixed build / support reset.
      const complete = await indexedDBStorage.getMetadata('migrationComplete');
      expect(complete).toBeUndefined();

      // Counter must not grow past the cap.
      const attempts = await indexedDBStorage.getMetadata('migrationAttempts');
      expect(attempts).toBe(3);

      // Data should NOT have been migrated.
      const result = await indexedDBStorage.getRichHistory(queryFilters());
      expect(result.total).toBe(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
