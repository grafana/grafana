import 'fake-indexeddb/auto';

import { DataQuery } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { RichHistorySearchBackendFilters, RichHistorySettings, SortOrder } from 'app/core/utils/richHistoryTypes';
import { RichHistoryQuery } from 'app/types/explore';

import RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// crypto.randomUUID may not be available in jsdom
let uuidCounter = 0;
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => `uuid-${++uuidCounter}`,
    },
    writable: true,
    configurable: true,
  });
}

interface MockQuery extends DataQuery {
  query: string;
}

const mockItem: Omit<RichHistoryQuery<MockQuery>, 'id' | 'createdAt'> = {
  starred: true,
  datasourceUid: 'dev-test',
  datasourceName: 'name-of-dev-test',
  comment: 'test',
  queries: [{ refId: 'ref', query: 'query-test' }],
};

const mockItem2: Omit<RichHistoryQuery<MockQuery>, 'id' | 'createdAt'> = {
  starred: true,
  datasourceUid: 'dev-test-2',
  datasourceName: 'name-of-dev-test-2',
  comment: 'test-2',
  queries: [{ refId: 'ref-2', query: 'query-2' }],
};

describe('RichHistoryIndexedDBStorage', () => {
  let storage: RichHistoryIndexedDBStorage;

  let nowMs: number;
  let oldMs: number;
  let dateNowSpy: jest.SpyInstance;

  function filtersWithTimeRange(overrides?: Partial<RichHistorySearchBackendFilters>): RichHistorySearchBackendFilters {
    return {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters: [],
      from: 0,
      to: nowMs + 86_400_000,
      starred: false,
      ...overrides,
    };
  }

  beforeEach(async () => {
    nowMs = new Date('2025-01-15T12:00:00Z').getTime();
    oldMs = new Date('2024-12-01T12:00:00Z').getTime();
    uuidCounter = 0;

    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
    (reportInteraction as jest.Mock).mockReset();

    storage = new RichHistoryIndexedDBStorage();
    // Clear all stores instead of deleting the DB (which requires closing connections)
    const db = await storage.getDB();
    await db.clear('queries');
    await db.clear('settings');
    await db.clear('metadata');
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('basic api', () => {
    it('should save and retrieve a query', async () => {
      const { richHistoryQuery } = await storage.addToRichHistory(mockItem);
      expect(richHistoryQuery.id).toBeDefined();
      expect(richHistoryQuery.createdAt).toBe(nowMs);
      expect(richHistoryQuery.datasourceName).toBe('name-of-dev-test');
      expect(richHistoryQuery.starred).toBe(true);

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory).toHaveLength(1);
      expect(richHistory[0]).toMatchObject({
        datasourceName: 'name-of-dev-test',
        comment: 'test',
        starred: true,
      });
    });

    it('should not save duplicated query', async () => {
      await storage.addToRichHistory(mockItem);
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory(mockItem2);

      await expect(storage.addToRichHistory(mockItem2)).rejects.toThrow('Entry already exists');

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory).toHaveLength(2);
    });

    it('should allow same queries with different key/refId (dedup ignores key and refId)', async () => {
      await storage.addToRichHistory({
        ...mockItem,
        queries: [{ refId: 'A', key: 'key1', query: 'same-query' } as MockQuery],
      });
      // Same query text but different refId/key should be detected as duplicate
      await expect(
        storage.addToRichHistory({
          ...mockItem,
          queries: [{ refId: 'B', key: 'key2', query: 'same-query' } as MockQuery],
        })
      ).rejects.toThrow('Entry already exists');
    });

    it('should update starred', async () => {
      const { richHistoryQuery } = await storage.addToRichHistory(mockItem);
      const updated = await storage.updateStarred(richHistoryQuery.id, false);
      expect(updated.starred).toBe(false);

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory[0].starred).toBe(false);
    });

    it('should throw when updating starred for non-existent item', async () => {
      await expect(storage.updateStarred('non-existent-id', true)).rejects.toThrow('Rich history item not found.');
    });

    it('should update comment', async () => {
      const { richHistoryQuery } = await storage.addToRichHistory(mockItem);
      const updated = await storage.updateComment(richHistoryQuery.id, 'new comment');
      expect(updated.comment).toBe('new comment');

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory[0].comment).toBe('new comment');
    });

    it('should set comment to empty string when undefined', async () => {
      const { richHistoryQuery } = await storage.addToRichHistory(mockItem);
      const updated = await storage.updateComment(richHistoryQuery.id, undefined);
      expect(updated.comment).toBe('');
    });

    it('should throw when updating comment for non-existent item', async () => {
      await expect(storage.updateComment('non-existent-id', 'comment')).rejects.toThrow('Rich history item not found.');
    });

    it('should delete a single query', async () => {
      const { richHistoryQuery } = await storage.addToRichHistory(mockItem);
      await storage.deleteRichHistory(richHistoryQuery.id);

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory).toHaveLength(0);
    });

    it('should delete all queries', async () => {
      await storage.addToRichHistory(mockItem);
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory(mockItem2);
      await storage.deleteAll();

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange());
      expect(richHistory).toHaveLength(0);
    });
  });

  describe('filtering', () => {
    it('should filter by starred', async () => {
      await storage.addToRichHistory({ ...mockItem, starred: true });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({ ...mockItem2, starred: false });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ starred: true }));
      expect(richHistory).toHaveLength(1);
      expect(richHistory[0].starred).toBe(true);
    });

    it('should filter by datasource name', async () => {
      await storage.addToRichHistory(mockItem);
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory(mockItem2);

      const { richHistory } = await storage.getRichHistory(
        filtersWithTimeRange({ datasourceFilters: ['name-of-dev-test'] })
      );
      expect(richHistory).toHaveLength(1);
      expect(richHistory[0].datasourceName).toBe('name-of-dev-test');
    });

    it('should filter by search text in comment', async () => {
      await storage.addToRichHistory({ ...mockItem, comment: 'find me here' });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({ ...mockItem2, comment: 'nothing relevant' });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ search: 'find me' }));
      expect(richHistory).toHaveLength(1);
      expect(richHistory[0].comment).toBe('find me here');
    });

    it('should filter by search text in query values', async () => {
      await storage.addToRichHistory({
        ...mockItem,
        queries: [{ refId: 'A', query: 'rate(http_requests_total[5m])' } as MockQuery],
      });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({
        ...mockItem2,
        queries: [{ refId: 'B', query: 'up == 1' } as MockQuery],
      });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ search: 'http_requests' }));
      expect(richHistory).toHaveLength(1);
    });

    it('should filter by time range', async () => {
      await storage.addToRichHistory(mockItem);

      // Manually insert an old entry via db (starred so it survives retention)
      const db = await storage.getDB();
      await db.put('queries', {
        id: 'old-entry',
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        createdAt: oldMs,
        starred: 1,
        comment: 'old',
        queries: [{ refId: 'A' }],
      });

      // Filter to only recent entries (last 7 days)
      const sevenDaysAgo = nowMs - 7 * 86_400_000;
      const { richHistory } = await storage.getRichHistory(
        filtersWithTimeRange({ from: sevenDaysAgo, to: nowMs + 86_400_000 })
      );
      expect(richHistory).toHaveLength(1);
      expect(richHistory[0].comment).toBe('test');
    });
  });

  describe('sorting', () => {
    it('should sort by descending createdAt', async () => {
      await storage.addToRichHistory({ ...mockItem, comment: 'first' });
      dateNowSpy.mockReturnValue(nowMs + 1000);
      await storage.addToRichHistory({ ...mockItem2, comment: 'second' });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ sortOrder: SortOrder.Descending }));
      expect(richHistory[0].comment).toBe('second');
      expect(richHistory[1].comment).toBe('first');
    });

    it('should sort by ascending createdAt', async () => {
      await storage.addToRichHistory({ ...mockItem, comment: 'first' });
      dateNowSpy.mockReturnValue(nowMs + 1000);
      await storage.addToRichHistory({ ...mockItem2, comment: 'second' });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ sortOrder: SortOrder.Ascending }));
      expect(richHistory[0].comment).toBe('first');
      expect(richHistory[1].comment).toBe('second');
    });

    it('should sort by datasource name A-Z', async () => {
      await storage.addToRichHistory({ ...mockItem, datasourceName: 'Zebra' });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({ ...mockItem2, datasourceName: 'Alpha' });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ sortOrder: SortOrder.DatasourceAZ }));
      // DatasourceAZ in existing code sorts Z first (descending by name)
      expect(richHistory[0].datasourceName).toBe('Zebra');
      expect(richHistory[1].datasourceName).toBe('Alpha');
    });

    it('should sort by datasource name Z-A', async () => {
      await storage.addToRichHistory({ ...mockItem, datasourceName: 'Zebra' });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({ ...mockItem2, datasourceName: 'Alpha' });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ sortOrder: SortOrder.DatasourceZA }));
      // DatasourceZA in existing code sorts A first (ascending by name)
      expect(richHistory[0].datasourceName).toBe('Alpha');
      expect(richHistory[1].datasourceName).toBe('Zebra');
    });
  });

  describe('retention policy', () => {
    it('should remove non-starred entries older than retention period', async () => {
      const db = await storage.getDB();

      // Insert old non-starred entry (45 days ago)
      const oldTimestamp = nowMs - 45 * 86_400_000;
      await db.put('queries', {
        id: 'old-not-starred',
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        createdAt: oldTimestamp,
        starred: 0,
        comment: 'old not starred',
        queries: [],
      });

      // Insert old starred entry (45 days ago)
      await db.put('queries', {
        id: 'old-starred',
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        createdAt: oldTimestamp,
        starred: 1,
        comment: 'old starred',
        queries: [],
      });

      // Insert recent entry
      await storage.addToRichHistory({ ...mockItem, comment: 'recent' });

      // getRichHistory triggers retention cleanup
      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ from: 0, to: nowMs + 86_400_000 }));

      const comments = richHistory.map((q) => q.comment);
      expect(comments).toContain('recent');
      expect(comments).toContain('old starred');
      expect(comments).not.toContain('old not starred');
    });

    it('should use configured retention period', async () => {
      // Set retention to 2 days
      await storage.updateSettings({
        retentionPeriod: 2,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: false,
        lastUsedDatasourceFilters: [],
      });

      const db = await storage.getDB();

      // Insert entry 3 days ago (should be cleaned)
      const threeDaysAgo = nowMs - 3 * 86_400_000;
      await db.put('queries', {
        id: 'three-days-old',
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        createdAt: threeDaysAgo,
        starred: 0,
        comment: 'three days old',
        queries: [],
      });

      // Insert entry 1 day ago (should survive)
      const oneDayAgo = nowMs - 1 * 86_400_000;
      await db.put('queries', {
        id: 'one-day-old',
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        createdAt: oneDayAgo,
        starred: 0,
        comment: 'one day old',
        queries: [],
      });

      const { richHistory } = await storage.getRichHistory(filtersWithTimeRange({ from: 0, to: nowMs + 86_400_000 }));

      const comments = richHistory.map((q) => q.comment);
      expect(comments).toContain('one day old');
      expect(comments).not.toContain('three days old');
    });
  });

  describe('settings', () => {
    it('should return default settings when none are saved', async () => {
      const settings = await storage.getSettings();
      expect(settings).toEqual({
        retentionPeriod: 7,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: false,
        lastUsedDatasourceFilters: [],
      });
    });

    it('should save and read settings', async () => {
      const settings: RichHistorySettings = {
        retentionPeriod: 14,
        starredTabAsFirstTab: true,
        activeDatasourcesOnly: true,
        lastUsedDatasourceFilters: ['prometheus', 'loki'],
      };

      await storage.updateSettings(settings);
      const loaded = await storage.getSettings();
      expect(loaded).toEqual(settings);
    });

    it('should handle partial settings update', async () => {
      await storage.updateSettings({
        retentionPeriod: 30,
        starredTabAsFirstTab: false,
        activeDatasourcesOnly: true,
      });

      const loaded = await storage.getSettings();
      expect(loaded.retentionPeriod).toBe(30);
      expect(loaded.activeDatasourcesOnly).toBe(true);
      expect(loaded.lastUsedDatasourceFilters).toEqual([]);
    });
  });

  describe('metadata', () => {
    it('should read and write metadata', async () => {
      await storage.setMetadata('migrationVersion', 1);
      const value = await storage.getMetadata('migrationVersion');
      expect(value).toBe(1);
    });

    it('should return undefined for missing metadata', async () => {
      const value = await storage.getMetadata('nonexistent');
      expect(value).toBeUndefined();
    });
  });

  describe('item count warning', () => {
    it('should report interaction when item count reaches threshold', async () => {
      const db = await storage.getDB();

      // Insert items just below threshold
      const tx = db.transaction('queries', 'readwrite');
      for (let i = 0; i < 49_999; i++) {
        tx.objectStore('queries').put({
          id: `bulk-${i}`,
          datasourceUid: 'dev-test',
          datasourceName: 'name-of-dev-test',
          createdAt: nowMs - i,
          starred: 0,
          comment: `entry-${i}`,
          queries: [],
        });
      }
      await tx.done;

      // Adding one more should trigger the warning (count becomes 50000)
      await storage.addToRichHistory({
        ...mockItem,
        queries: [{ refId: 'unique', query: 'unique-query' } as MockQuery],
      });

      expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_item_count_warning', {
        itemCount: 50_000,
      });
    });
  });

  describe('total count', () => {
    it('should return correct total count', async () => {
      await storage.addToRichHistory(mockItem);
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory(mockItem2);

      const { total } = await storage.getRichHistory(filtersWithTimeRange());
      expect(total).toBe(2);
    });

    it('should return filtered total count', async () => {
      await storage.addToRichHistory({ ...mockItem, starred: true });
      dateNowSpy.mockReturnValue(nowMs + 1);
      await storage.addToRichHistory({ ...mockItem2, starred: false });

      const { total } = await storage.getRichHistory(filtersWithTimeRange({ starred: true }));
      expect(total).toBe(1);
    });
  });
});
