import {
  addToRichHistory,
  updateStarredInRichHistory,
  updateCommentInRichHistory,
  mapNumbertoTimeInSlider,
  createDateStringFromTs,
  createQueryHeading,
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
  filterAndSortQueries,
  SortOrder,
} from './richHistory';
import store from 'app/core/store';
import { dateTime, DataQuery } from '@grafana/data';
import RichHistoryStorage, { RichHistoryServiceError, RichHistoryStorageWarning } from '../history/RichHistoryStorage';

const richHistoryStorageMock: RichHistoryStorage = {} as RichHistoryStorage;

jest.mock('../history/richHistoryStorageProvider', () => {
  return {
    getRichHistoryStorage: () => richHistoryStorageMock,
  };
});

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

    richHistoryStorageMock.addToRichHistory = jest.fn().mockResolvedValue(undefined);
    richHistoryStorageMock.deleteAll = jest.fn().mockResolvedValue({});
    richHistoryStorageMock.deleteRichHistory = jest.fn().mockResolvedValue({});
    richHistoryStorageMock.getRichHistory = jest.fn().mockResolvedValue({});
    richHistoryStorageMock.updateComment = jest.fn().mockResolvedValue({});
    richHistoryStorageMock.updateStarred = jest.fn().mockResolvedValue({});
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

    it('should append query to query history', async () => {
      Date.now = jest.fn(() => 2);
      const { richHistory: newHistory } = await addToRichHistory(
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

    it('should add query history to storage', async () => {
      Date.now = jest.fn(() => 2);

      const { richHistory } = await addToRichHistory(
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
      expect(richHistory).toMatchObject(expectedResult);
      expect(richHistoryStorageMock.addToRichHistory).toBeCalledWith({
        datasourceName: mock.testDatasourceName,
        datasourceId: mock.testDatasourceId,
        starred: mock.testStarred,
        comment: mock.testComment,
        sessionName: mock.testSessionName,
        queries: mock.testQueries,
        ts: 2,
      });
    });

    it('should not append duplicated query to query history', async () => {
      Date.now = jest.fn(() => 2);

      const duplicatedEntryError = new Error();
      duplicatedEntryError.name = RichHistoryServiceError.DuplicatedEntry;
      richHistoryStorageMock.addToRichHistory = jest.fn().mockRejectedValue(duplicatedEntryError);

      const { richHistory: newHistory } = await addToRichHistory(
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

    it('it should append new items even when the limit is exceeded', async () => {
      Date.now = jest.fn(() => 2);

      richHistoryStorageMock.addToRichHistory = jest.fn().mockReturnValue({
        type: RichHistoryStorageWarning.LimitExceeded,
        message: 'Limit exceeded',
      });

      const { richHistory, limitExceeded } = await addToRichHistory(
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
      expect(richHistory).toEqual(expectedResult);
      expect(limitExceeded).toBeTruthy();
    });
  });

  describe('updateStarredInRichHistory', () => {
    it('should update starred in query in history', async () => {
      const updatedStarred = await updateStarredInRichHistory(mock.storedHistory, 1);
      expect(updatedStarred[0].starred).toEqual(false);
    });
  });

  describe('updateCommentInRichHistory', () => {
    it('should update comment in query in history', async () => {
      const updatedComment = await updateCommentInRichHistory(mock.storedHistory, 1, 'new comment');
      expect(updatedComment[0].comment).toEqual('new comment');
    });
  });

  describe('deleteQueryInRichHistory', () => {
    it('should delete query in query in history', async () => {
      const deletedHistory = await deleteQueryInRichHistory(mock.storedHistory, 1);
      expect(deletedHistory).toEqual([]);
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
});
