import RichHistoryLocalStorage, { MAX_HISTORY_ITEMS } from './RichHistoryLocalStorage';
import store from 'app/core/store';
import { RichHistoryQuery } from '../../types';
import { DataQuery } from '@grafana/data';
import { afterEach, beforeEach } from '../../../test/lib/common';
import { RichHistoryStorageWarning } from './RichHistoryStorage';

const key = 'grafana.explore.richHistory';

const mockItem: RichHistoryQuery = {
  ts: 2,
  starred: true,
  datasourceName: 'dev-test',
  comment: 'test',
  queries: [{ refId: 'ref', query: 'query-test' } as DataQuery],
};

const mockItem2: RichHistoryQuery = {
  ts: 3,
  starred: true,
  datasourceName: 'dev-test-2',
  comment: 'test-2',
  queries: [{ refId: 'ref-2', query: 'query-2' } as DataQuery],
};

describe('RichHistoryLocalStorage', () => {
  let storage: RichHistoryLocalStorage;

  beforeEach(async () => {
    storage = new RichHistoryLocalStorage();
    await storage.deleteAll();
  });

  describe('basic api', () => {
    let dateSpy: jest.SpyInstance;

    beforeEach(() => {
      dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => 2);
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });

    it('should save query history to localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      expect(store.exists(key)).toBeTruthy();
      expect(store.getObject(key)).toMatchObject([mockItem]);
    });

    it('should not save duplicated query to localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.addToRichHistory(mockItem2);
      await expect(async () => {
        await storage.addToRichHistory(mockItem2);
      }).rejects.toThrow('Entry already exists');
      expect(store.getObject(key)).toMatchObject([mockItem2, mockItem]);
    });

    it('should update starred in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateStarred(mockItem.ts, false);
      expect(store.getObject(key)[0].starred).toEqual(false);
    });

    it('should update comment in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateComment(mockItem.ts, 'new comment');
      expect(store.getObject(key)[0].comment).toEqual('new comment');
    });

    it('should delete query in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.deleteRichHistory(mockItem.ts);
      expect(store.getObject(key)).toEqual([]);
    });
  });

  describe('retention policy and max limits', () => {
    it('should clear old not-starred items', async () => {
      const now = Date.now();
      const history = [
        { starred: true, ts: 0, queries: [] },
        { starred: true, ts: now, queries: [] },
        { starred: false, ts: 0, queries: [] },
        { starred: false, ts: now, queries: [] },
      ];
      store.setObject(key, history);

      await storage.addToRichHistory(mockItem);
      const richHistory = await storage.getRichHistory();

      expect(richHistory).toMatchObject([
        mockItem,
        { starred: true, ts: 0, queries: [] },
        { starred: true, ts: now, queries: [] },
        { starred: false, ts: now, queries: [] },
      ]);
    });

    it('should not save more than MAX_HISTORY_ITEMS', async () => {
      // For testing we create storage of MAX_HISTORY_ITEMS + extraItems. Half ot these items are starred.
      const extraItems = 100;

      let history = [];
      for (let i = 0; i < MAX_HISTORY_ITEMS + extraItems; i++) {
        history.push({
          starred: i % 2 === 0,
          comment: i.toString(),
          queries: [],
          ts: Date.now() + 10000, // to bypass retention policy
        });
      }

      const starredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
      const notStarredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;

      expect(history.filter((h) => h.starred)).toHaveLength(starredItemsInHistory);
      expect(history.filter((h) => !h.starred)).toHaveLength(notStarredItemsInHistory);

      store.setObject(key, history);
      const warning = await storage.addToRichHistory(mockItem);
      expect(warning).toMatchObject({
        type: RichHistoryStorageWarning.LimitExceeded,
      });

      // one not starred replaced with a newly added starred item
      const removedNotStarredItems = extraItems + 1; // + 1 to make space for the new item
      const newHistory = store.getObject(key);
      expect(newHistory).toHaveLength(MAX_HISTORY_ITEMS); // starred item added
      expect(newHistory.filter((h: RichHistoryQuery) => h.starred)).toHaveLength(starredItemsInHistory + 1); // starred item added
      expect(newHistory.filter((h: RichHistoryQuery) => !h.starred)).toHaveLength(
        starredItemsInHistory - removedNotStarredItems
      );
    });
  });

  describe('migration', () => {
    afterEach(() => {
      storage.deleteAll();
      expect(store.exists(key)).toBeFalsy();
    });

    describe('should load from localStorage data in old formats', () => {
      it('should load when queries are strings', async () => {
        const oldHistoryItem = {
          ...mockItem,
          queries: ['test query 1', 'test query 2', 'test query 3'],
        };
        store.setObject(key, [oldHistoryItem]);
        const expectedHistoryItem = {
          ...mockItem,
          queries: [
            {
              expr: 'test query 1',
              refId: 'A',
            },
            {
              expr: 'test query 2',
              refId: 'B',
            },
            {
              expr: 'test query 3',
              refId: 'C',
            },
          ],
        };

        const result = await storage.getRichHistory();
        expect(result).toStrictEqual([expectedHistoryItem]);
      });

      it('should load when queries are json-encoded strings', async () => {
        const oldHistoryItem = {
          ...mockItem,
          queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'],
        };
        store.setObject(key, [oldHistoryItem]);
        const expectedHistoryItem = {
          ...mockItem,
          queries: [
            {
              refId: 'A',
              key: 'key1',
              metrics: [],
            },
            {
              refId: 'B',
              key: 'key2',
              metrics: [],
            },
          ],
        };

        const result = await storage.getRichHistory();
        expect(result).toStrictEqual([expectedHistoryItem]);
      });
    });
  });
});
