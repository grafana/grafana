import RichHistoryLocalStorage, { MAX_HISTORY_ITEMS } from './RichHistoryLocalStorage';
import store from 'app/core/store';
import { RichHistoryQuery } from '../../types';
import { DataQuery } from '@grafana/data';
import { afterEach, beforeEach } from '../../../test/lib/common';
import { RichHistoryStorageWarning } from './RichHistoryStorage';
import { backendSrv } from '../services/backend_srv';

const key = 'grafana.explore.richHistory';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getList: () => {
        return [
          { uid: 'dev-test-uid', name: 'dev-test' },
          { uid: 'dev-test-2-uid', name: 'dev-test-2' },
        ];
      },
    };
  },
}));

interface MockQuery extends DataQuery {
  query: string;
}

const mockItem: RichHistoryQuery<MockQuery> = {
  id: '2',
  createdAt: 2,
  starred: true,
  datasourceUid: 'dev-test-uid',
  datasourceName: 'dev-test',
  comment: 'test',
  queries: [{ refId: 'ref', query: 'query-test' }],
};

const mockItem2: RichHistoryQuery<MockQuery> = {
  id: '3',
  createdAt: 3,
  starred: true,
  datasourceUid: 'dev-test-2-uid',
  datasourceName: 'dev-test-2',
  comment: 'test-2',
  queries: [{ refId: 'ref-2', query: 'query-2' }],
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
      expect(await storage.getRichHistory()).toMatchObject([mockItem]);
    });

    it('should not save duplicated query to localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.addToRichHistory(mockItem2);
      await expect(async () => {
        await storage.addToRichHistory(mockItem2);
      }).rejects.toThrow('Entry already exists');
      expect(await storage.getRichHistory()).toMatchObject([mockItem2, mockItem]);
    });

    it('should update starred in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateStarred(mockItem.id, false);
      expect((await storage.getRichHistory())[0].starred).toEqual(false);
    });

    it('should update comment in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateComment(mockItem.id, 'new comment');
      expect((await storage.getRichHistory())[0].comment).toEqual('new comment');
    });

    it('should delete query in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.deleteRichHistory(mockItem.id);
      expect(await storage.getRichHistory()).toEqual([]);
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
        { starred: true, createdAt: 0, queries: [] },
        { starred: true, createdAt: now, queries: [] },
        { starred: false, createdAt: now, queries: [] },
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
      const { warning } = await storage.addToRichHistory(mockItem);
      expect(warning).toMatchObject({
        type: RichHistoryStorageWarning.LimitExceeded,
      });

      // one not starred replaced with a newly added starred item
      const removedNotStarredItems = extraItems + 1; // + 1 to make space for the new item
      const newHistory = store.getObject<typeof history>(key)!;
      expect(newHistory).toHaveLength(MAX_HISTORY_ITEMS); // starred item added
      expect(newHistory.filter((h) => h.starred)).toHaveLength(starredItemsInHistory + 1); // starred item added
      expect(newHistory.filter((h) => !h.starred)).toHaveLength(starredItemsInHistory - removedNotStarredItems);
    });
  });

  describe('migration', () => {
    afterEach(() => {
      storage.deleteAll();
      expect(store.exists(key)).toBeFalsy();
    });

    describe('should load from localStorage data in old formats', () => {
      it('should load when queries are strings', async () => {
        store.setObject(key, [
          {
            ts: 2,
            starred: true,
            datasourceName: 'dev-test',
            comment: 'test',
            queries: ['test query 1', 'test query 2', 'test query 3'],
          },
        ]);
        const expectedHistoryItem = {
          id: '2',
          createdAt: 2,
          starred: true,
          datasourceUid: 'dev-test-uid',
          datasourceName: 'dev-test',
          comment: 'test',
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
        store.setObject(key, [
          {
            ts: 2,
            starred: true,
            datasourceName: 'dev-test',
            comment: 'test',
            queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'],
          },
        ]);
        const expectedHistoryItem = {
          id: '2',
          createdAt: 2,
          starred: true,
          datasourceUid: 'dev-test-uid',
          datasourceName: 'dev-test',
          comment: 'test',
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
