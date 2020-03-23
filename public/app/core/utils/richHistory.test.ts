import {
  addToRichHistory,
  updateStarredInRichHistory,
  updateCommentInRichHistory,
  mapNumbertoTimeInSlider,
  createDateStringFromTs,
  createQueryHeading,
  createDataQuery,
  deleteAllFromRichHistory,
  deleteQueryInRichHistory,
} from './richHistory';
import store from 'app/core/store';
import { SortOrder } from './explore';

const mock: any = {
  history: [
    {
      comment: '',
      datasourceId: 'datasource historyId',
      datasourceName: 'datasource history name',
      queries: ['query1', 'query2'],
      sessionName: '',
      starred: true,
      ts: 1,
    },
  ],
  comment: '',
  datasourceId: 'datasourceId',
  datasourceName: 'datasourceName',
  queries: ['query3'],
  sessionName: '',
  starred: false,
};

const key = 'grafana.explore.richHistory';

describe('addToRichHistory', () => {
  beforeEach(() => {
    deleteAllFromRichHistory();
    expect(store.exists(key)).toBeFalsy();
  });

  const expectedResult = [
    {
      comment: mock.comment,
      datasourceId: mock.datasourceId,
      datasourceName: mock.datasourceName,
      queries: mock.queries,
      sessionName: mock.sessionName,
      starred: mock.starred,
      ts: 2,
    },
    mock.history[0],
  ];

  it('should append query to query history', () => {
    Date.now = jest.fn(() => 2);
    const newHistory = addToRichHistory(
      mock.history,
      mock.datasourceId,
      mock.datasourceName,
      mock.queries,
      mock.starred,
      mock.comment,
      mock.sessionName
    );
    expect(newHistory).toEqual(expectedResult);
  });

  it('should save query history to localStorage', () => {
    Date.now = jest.fn(() => 2);

    addToRichHistory(
      mock.history,
      mock.datasourceId,
      mock.datasourceName,
      mock.queries,
      mock.starred,
      mock.comment,
      mock.sessionName
    );
    expect(store.exists(key)).toBeTruthy();
    expect(store.getObject(key)).toMatchObject(expectedResult);
  });

  it('should not append duplicated query to query history', () => {
    Date.now = jest.fn(() => 2);
    const newHistory = addToRichHistory(
      mock.history,
      mock.history[0].datasourceId,
      mock.history[0].datasourceName,
      mock.history[0].queries,
      mock.starred,
      mock.comment,
      mock.sessionName
    );
    expect(newHistory).toEqual([mock.history[0]]);
  });

  it('should not save duplicated query to localStorage', () => {
    Date.now = jest.fn(() => 2);
    addToRichHistory(
      mock.history,
      mock.history[0].datasourceId,
      mock.history[0].datasourceName,
      mock.history[0].queries,
      mock.starred,
      mock.comment,
      mock.sessionName
    );
    expect(store.exists(key)).toBeFalsy();
  });
});

describe('updateStarredInRichHistory', () => {
  it('should update starred in query in history', () => {
    const updatedStarred = updateStarredInRichHistory(mock.history, 1);
    expect(updatedStarred[0].starred).toEqual(false);
  });
  it('should update starred in localStorage', () => {
    updateStarredInRichHistory(mock.history, 1);
    expect(store.exists(key)).toBeTruthy();
    expect(store.getObject(key)[0].starred).toEqual(false);
  });
});

describe('updateCommentInRichHistory', () => {
  it('should update comment in query in history', () => {
    const updatedComment = updateCommentInRichHistory(mock.history, 1, 'new comment');
    expect(updatedComment[0].comment).toEqual('new comment');
  });
  it('should update comment in localStorage', () => {
    updateCommentInRichHistory(mock.history, 1, 'new comment');
    expect(store.exists(key)).toBeTruthy();
    expect(store.getObject(key)[0].comment).toEqual('new comment');
  });
});

describe('deleteQueryInRichHistory', () => {
  it('should delete query in query in history', () => {
    const deletedHistory = deleteQueryInRichHistory(mock.history, 1);
    expect(deletedHistory).toEqual([]);
  });
  it('should delete query in localStorage', () => {
    deleteQueryInRichHistory(mock.history, 1);
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

describe('createQueryHeading', () => {
  it('should correctly create heading for queries when sort order is ascending ', () => {
    const heading = createQueryHeading(mock.history[0], SortOrder.Ascending);
    expect(heading).toEqual('January 1');
  });
  it('should correctly create heading for queries when sort order is datasourceAZ ', () => {
    const heading = createQueryHeading(mock.history[0], SortOrder.DatasourceAZ);
    expect(heading).toEqual(mock.history[0].datasourceName);
  });
});

describe('createDataQuery', () => {
  it('should correctly create data query from rich history query', () => {
    const dataQuery = createDataQuery(mock.history[0], mock.queries[0], 0);
    expect(dataQuery).toEqual({ datasource: 'datasource history name', expr: 'query3', refId: 'A' });
  });
});
