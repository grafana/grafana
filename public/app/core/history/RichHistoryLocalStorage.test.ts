import { DataQuery } from '@grafana/data';
import store from 'app/core/store';

import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { RichHistoryQuery } from '../../types';
import { backendSrv } from '../services/backend_srv';
import { RichHistorySearchFilters, RichHistorySettings, SortOrder } from '../utils/richHistoryTypes';

import RichHistoryLocalStorage, { MAX_HISTORY_ITEMS } from './RichHistoryLocalStorage';
import { RichHistoryStorageWarning } from './RichHistoryStorage';

const key = 'grafana.explore.richHistory';

const dsMock = new DatasourceSrv();
dsMock.init(
  {
    // @ts-ignore
    'name-of-dev-test': { uid: 'dev-test', name: 'name-of-dev-test' },
    // @ts-ignore
    'name-of-dev-test-2': { uid: 'dev-test-2', name: 'name-of-dev-test-2' },
  },
  ''
);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => dsMock,
}));

interface MockQuery extends DataQuery {
  query: string;
}

const mockFilters: RichHistorySearchFilters = {
  search: '',
  sortOrder: SortOrder.Descending,
  datasourceFilters: [],
  from: 0,
  to: 7,
  starred: false,
};

const mockItem: RichHistoryQuery<MockQuery> = {
  id: '2',
  createdAt: 2,
  starred: true,
  datasourceUid: 'dev-test',
  datasourceName: 'name-of-dev-test',
  comment: 'test',
  queries: [{ refId: 'ref', query: 'query-test' }],
};

const mockItem2: RichHistoryQuery<MockQuery> = {
  id: '3',
  createdAt: 3,
  starred: true,
  datasourceUid: 'dev-test-2',
  datasourceName: 'name-of-dev-test-2',
  comment: 'test-2',
  queries: [{ refId: 'ref-2', query: 'query-2' }],
};

describe('RichHistoryLocalStorage', () => {
  let storage: RichHistoryLocalStorage;

  let now: Date;
  let old: Date;

  beforeEach(async () => {
    now = new Date(1970, 0, 1);
    old = new Date(1969, 0, 1);

    jest.useFakeTimers();
    jest.setSystemTime(now);
    storage = new RichHistoryLocalStorage();
    await storage.deleteAll();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic api', () => {
    it('should save query history to localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      expect(store.exists(key)).toBeTruthy();
      expect((await storage.getRichHistory(mockFilters)).richHistory).toMatchObject([mockItem]);
    });

    it('should not save duplicated query to localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.addToRichHistory(mockItem2);
      await expect(async () => {
        await storage.addToRichHistory(mockItem2);
      }).rejects.toThrow('Entry already exists');
      expect((await storage.getRichHistory(mockFilters)).richHistory).toMatchObject([mockItem2, mockItem]);
    });

    it('should update starred in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateStarred(mockItem.id, false);
      expect((await storage.getRichHistory(mockFilters)).richHistory[0].starred).toEqual(false);
    });

    it('should update comment in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.updateComment(mockItem.id, 'new comment');
      expect((await storage.getRichHistory(mockFilters)).richHistory[0].comment).toEqual('new comment');
    });

    it('should delete query in localStorage', async () => {
      await storage.addToRichHistory(mockItem);
      await storage.deleteRichHistory(mockItem.id);
      expect((await storage.getRichHistory(mockFilters)).richHistory).toEqual([]);
      expect(store.getObject(key)).toEqual([]);
    });

    it('should save and read settings', async () => {
      const settings: RichHistorySettings = {
        retentionPeriod: 2,
        starredTabAsFirstTab: true,
        activeDatasourceOnly: true,
        lastUsedDatasourceFilters: ['foobar'],
      };
      await storage.updateSettings(settings);
      const storageSettings = storage.getSettings();

      expect(settings).toMatchObject(storageSettings);
    });
  });

  describe('retention policy and max limits', () => {
    it('should clear old not-starred items', async () => {
      const historyStarredOld = {
        starred: true,
        ts: old.getTime(),
        queries: [],
        comment: 'old starred',
        datasourceName: 'name-of-dev-test',
      };
      const historyNotStarredOld = {
        starred: false,
        ts: old.getTime(),
        queries: [],
        comment: 'new not starred',
        datasourceName: 'name-of-dev-test',
      };
      const historyStarredNew = {
        starred: true,
        ts: now.getTime(),
        queries: [],
        comment: 'new starred',
        datasourceName: 'name-of-dev-test',
      };
      const historyNotStarredNew = {
        starred: false,
        ts: now.getTime(),
        queries: [],
        comment: 'new not starred',
        datasourceName: 'name-of-dev-test',
      };
      const history = [historyNotStarredNew, historyStarredNew, historyStarredOld, historyNotStarredOld];
      store.setObject(key, history);

      const historyNew = {
        starred: true,
        datasourceUid: 'dev-test',
        datasourceName: 'name-of-dev-test',
        comment: 'recently added',
        queries: [{ refId: 'ref' }],
      };
      await storage.addToRichHistory(historyNew);
      const { richHistory } = await storage.getRichHistory({
        search: '',
        sortOrder: SortOrder.Descending,
        datasourceFilters: [],
        from: 0,
        to: 1000, // 1000 days: use a filter that is beyond retention policy to check old items were removed correctly
        starred: false,
      });

      expect(richHistory).toMatchObject([
        expect.objectContaining({ comment: 'recently added' }),
        expect.objectContaining({ comment: 'new not starred' }),
        expect.objectContaining({ comment: 'new starred' }),
        expect.objectContaining({ comment: 'old starred' }),
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
            datasourceName: 'name-of-dev-test',
            comment: 'test',
            queries: ['test query 1', 'test query 2', 'test query 3'],
          },
        ]);
        const expectedHistoryItem = {
          id: '2',
          createdAt: 2,
          starred: true,
          datasourceUid: 'dev-test',
          datasourceName: 'name-of-dev-test',
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

        const { richHistory, total } = await storage.getRichHistory(mockFilters);
        expect(richHistory).toStrictEqual([expectedHistoryItem]);
        expect(total).toBe(1);
      });

      it('should load when queries are json-encoded strings', async () => {
        store.setObject(key, [
          {
            ts: 2,
            starred: true,
            datasourceName: 'name-of-dev-test',
            comment: 'test',
            queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'],
          },
        ]);
        const expectedHistoryItem = {
          id: '2',
          createdAt: 2,
          starred: true,
          datasourceUid: 'dev-test',
          datasourceName: 'name-of-dev-test',
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

        const { richHistory, total } = await storage.getRichHistory(mockFilters);
        expect(richHistory).toStrictEqual([expectedHistoryItem]);
        expect(total).toBe(1);
      });
    });
  });
});
