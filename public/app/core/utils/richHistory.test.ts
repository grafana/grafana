import {
  addToRichHistory,
  getRichHistory,
  updateStarredInRichHistory,
  updateCommentInRichHistory,
  mapNumbertoTimeInSlider,
  createDateStringFromTs,
  createQueryHeading,
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  filterAndSortQueries,
  SortOrder,
  MAX_HISTORY_ITEMS,
} from './richHistory';
import store from 'app/core/store';
import { dateTime, DataQuery } from '@grafana/data';
import { RichHistoryQuery } from '../../types';

const mock: any = {
  storedHistory: [
    {
      comment: '',
      datasourceId: 'datasource historyId',
      datasourceName: 'datasource history name',
      queries: [
        { expr: 'query1', maxLines: null, refId: '1' },
        { expr: 'query2', refId: '2' },
      ],
      sessionName: '',
      starred: true,
      ts: 1,
    },
  ],
  testComment: '',
  testDatasourceId: 'datasourceId',
  testDatasourceName: 'datasourceName',
  testQueries: [
    { expr: 'query3', refId: 'B' },
    { expr: 'query4', refId: 'C' },
  ],
  testSessionName: '',
  testStarred: false,
};

const key = 'grafana.explore.richHistory';

describe('richHistory', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date(1970, 0, 1));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addToRichHistory', () => {
    beforeEach(() => {
      deleteAllFromRichHistory();
      expect(store.exists(key)).toBeFalsy();
    });
    const expectedResult = [
      {
        comment: mock.testComment,
        datasourceId: mock.testDatasourceId,
        datasourceName: mock.testDatasourceName,
        queries: mock.testQueries,
        sessionName: mock.testSessionName,
        starred: mock.testStarred,
        ts: 2,
      },
      mock.storedHistory[0],
    ];

    it('should append query to query history', () => {
      Date.now = jest.fn(() => 2);
      const { richHistory: newHistory } = addToRichHistory(
        mock.storedHistory,
        mock.testDatasourceId,
        mock.testDatasourceName,
        mock.testQueries,
        mock.testStarred,
        mock.testComment,
        mock.testSessionName,
        true,
        true
      );
      expect(newHistory).toEqual(expectedResult);
    });

    it('should save query history to localStorage', () => {
      Date.now = jest.fn(() => 2);

      addToRichHistory(
        mock.storedHistory,
        mock.testDatasourceId,
        mock.testDatasourceName,
        mock.testQueries,
        mock.testStarred,
        mock.testComment,
        mock.testSessionName,
        true,
        true
      );
      expect(store.exists(key)).toBeTruthy();
      expect(store.getObject(key)).toMatchObject(expectedResult);
    });

    it('should not append duplicated query to query history', () => {
      Date.now = jest.fn(() => 2);
      const { richHistory: newHistory } = addToRichHistory(
        mock.storedHistory,
        mock.storedHistory[0].datasourceId,
        mock.storedHistory[0].datasourceName,
        [{ expr: 'query1', maxLines: null, refId: 'A' } as DataQuery, { expr: 'query2', refId: 'B' } as DataQuery],
        mock.testStarred,
        mock.testComment,
        mock.testSessionName,
        true,
        true
      );
      expect(newHistory).toEqual([mock.storedHistory[0]]);
    });

    it('should not save duplicated query to localStorage', () => {
      Date.now = jest.fn(() => 2);
      addToRichHistory(
        mock.storedHistory,
        mock.storedHistory[0].datasourceId,
        mock.storedHistory[0].datasourceName,
        [{ expr: 'query1', maxLines: null, refId: 'A' } as DataQuery, { expr: 'query2', refId: 'B' } as DataQuery],
        mock.testStarred,
        mock.testComment,
        mock.testSessionName,
        true,
        true
      );
      expect(store.exists(key)).toBeFalsy();
    });

    it('should not save more than MAX_HISTORY_ITEMS', () => {
      Date.now = jest.fn(() => 2);
      const extraItems = 100;

      // the history has more than MAX
      let history = [];
      // history = [ { starred: true, comment: "0" }, { starred: false, comment: "1" }, ... ]
      for (let i = 0; i < MAX_HISTORY_ITEMS + extraItems; i++) {
        history.push({
          starred: i % 2 === 0,
          comment: i.toString(),
          queries: [],
          ts: new Date(2019, 11, 31).getTime(),
        });
      }

      const starredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;
      const notStarredItemsInHistory = (MAX_HISTORY_ITEMS + extraItems) / 2;

      expect(history.filter((h) => h.starred)).toHaveLength(starredItemsInHistory);
      expect(history.filter((h) => !h.starred)).toHaveLength(notStarredItemsInHistory);

      const { richHistory: newHistory } = addToRichHistory(
        (history as any) as RichHistoryQuery[],
        mock.storedHistory[0].datasourceId,
        mock.storedHistory[0].datasourceName,
        [{ expr: 'query1', maxLines: null, refId: 'A' } as DataQuery, { expr: 'query2', refId: 'B' } as DataQuery],
        true,
        mock.testComment,
        mock.testSessionName,
        true,
        true
      );

      // one not starred replaced with a newly added starred item
      const removedNotStarredItems = extraItems + 1; // + 1 to make space for the new item
      expect(newHistory.filter((h) => h.starred)).toHaveLength(starredItemsInHistory + 1); // starred item added
      expect(newHistory.filter((h) => !h.starred)).toHaveLength(starredItemsInHistory - removedNotStarredItems);
    });
  });

  describe('updateStarredInRichHistory', () => {
    it('should update starred in query in history', () => {
      const updatedStarred = updateStarredInRichHistory(mock.storedHistory, 1);
      expect(updatedStarred[0].starred).toEqual(false);
    });
    it('should update starred in localStorage', () => {
      updateStarredInRichHistory(mock.storedHistory, 1);
      expect(store.exists(key)).toBeTruthy();
      expect(store.getObject(key)[0].starred).toEqual(false);
    });
  });

  describe('updateCommentInRichHistory', () => {
    it('should update comment in query in history', () => {
      const updatedComment = updateCommentInRichHistory(mock.storedHistory, 1, 'new comment');
      expect(updatedComment[0].comment).toEqual('new comment');
    });
    it('should update comment in localStorage', () => {
      updateCommentInRichHistory(mock.storedHistory, 1, 'new comment');
      expect(store.exists(key)).toBeTruthy();
      expect(store.getObject(key)[0].comment).toEqual('new comment');
    });
  });

  describe('deleteQueryInRichHistory', () => {
    it('should delete query in query in history', () => {
      const deletedHistory = deleteQueryInRichHistory(mock.storedHistory, 1);
      expect(deletedHistory).toEqual([]);
    });
    it('should delete query in localStorage', () => {
      deleteQueryInRichHistory(mock.storedHistory, 1);
      expect(store.exists(key)).toBeTruthy();
      expect(store.getObject(key)).toEqual([]);
    });
  });

  describe('mapNumbertoTimeInSlider', () => {
    it('should correctly map number to value', () => {
      const value = mapNumbertoTimeInSlider(25);
      expect(value).toEqual('25 days ago');
    });
  });

  describe('createDateStringFromTs', () => {
    it('should correctly create string value from timestamp', () => {
      const value = createDateStringFromTs(1583932327000);
      expect(value).toEqual('March 11');
    });
  });

  describe('filterQueries', () => {
    it('should filter out queries based on data source filter', () => {
      const filteredQueries = filterAndSortQueries(
        mock.storedHistory,
        SortOrder.Ascending,
        ['not provided data source'],
        ''
      );
      expect(filteredQueries).toHaveLength(0);
    });
    it('should keep queries based on data source filter', () => {
      const filteredQueries = filterAndSortQueries(
        mock.storedHistory,
        SortOrder.Ascending,
        ['datasource history name'],
        ''
      );
      expect(filteredQueries).toHaveLength(1);
    });
    it('should filter out all queries based on search filter', () => {
      const filteredQueries = filterAndSortQueries(
        mock.storedHistory,
        SortOrder.Ascending,
        [],
        'i do not exist in query'
      );
      expect(filteredQueries).toHaveLength(0);
    });
    it('should include queries based on search filter', () => {
      const filteredQueries = filterAndSortQueries(mock.storedHistory, SortOrder.Ascending, [], 'query1');
      expect(filteredQueries).toHaveLength(1);
    });
  });

  describe('createQueryHeading', () => {
    it('should correctly create heading for queries when sort order is ascending ', () => {
      // Have to offset the timezone of a 1 microsecond epoch, and then reverse the changes
      mock.storedHistory[0].ts = 1 + -1 * dateTime().utcOffset() * 60 * 1000;
      const heading = createQueryHeading(mock.storedHistory[0], SortOrder.Ascending);
      expect(heading).toEqual('January 1');
    });
    it('should correctly create heading for queries when sort order is datasourceAZ ', () => {
      const heading = createQueryHeading(mock.storedHistory[0], SortOrder.DatasourceAZ);
      expect(heading).toEqual(mock.storedHistory[0].datasourceName);
    });
  });

  describe('getRichHistory', () => {
    afterEach(() => {
      deleteAllFromRichHistory();
      expect(store.exists(key)).toBeFalsy();
    });
    describe('should load from localStorage data in old formats', () => {
      it('should load when queries are strings', () => {
        const oldHistoryItem = { ...mock.storedHistory[0], queries: ['test query 1', 'test query 2', 'test query 3'] };
        store.setObject(key, [oldHistoryItem]);
        const expectedHistoryItem = {
          ...mock.storedHistory[0],
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

        const result = getRichHistory();
        expect(result).toStrictEqual([expectedHistoryItem]);
      });

      it('should load when queries are json-encoded strings', () => {
        const oldHistoryItem = {
          ...mock.storedHistory[0],
          queries: ['{"refId":"A","key":"key1","metrics":[]}', '{"refId":"B","key":"key2","metrics":[]}'],
        };
        store.setObject(key, [oldHistoryItem]);
        const expectedHistoryItem = {
          ...mock.storedHistory[0],
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

        const result = getRichHistory();
        expect(result).toStrictEqual([expectedHistoryItem]);
      });
    });
  });
});
