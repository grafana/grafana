import { fireEvent, render, screen, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataSourceApi, DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { MixedDatasource } from 'app/plugins/datasource/mixed/MixedDataSource';
import { configureStore } from 'app/store/configureStore';
import { ShowConfirmModalEvent } from 'app/types/events';
import { ExploreState, RichHistoryQuery } from 'app/types/explore';

import { RichHistoryCard, Props } from './RichHistoryCard';

const starRichHistoryMock = jest.fn();
const deleteRichHistoryMock = jest.fn();

const mockEventBus = {
  publish: jest.fn(),
};

class MockDatasourceApi<T extends DataQuery> implements DataSourceApi<T> {
  name: string;
  id: number;
  type: string;
  uid: string;
  meta: DataSourcePluginMeta<{}>;

  constructor(name: string, id: number, type: string, uid: string, others?: Partial<DataSourceApi>) {
    this.name = name;
    this.id = id;
    this.type = type;
    this.uid = uid;
    this.meta = {
      info: {
        logos: {
          small: `${type}.png`,
        },
      },
    } as DataSourcePluginMeta;

    Object.assign(this, others);
  }

  query(): ReturnType<DataSourceApi['query']> {
    throw new Error('Method not implemented.');
  }
  testDatasource(): ReturnType<DataSourceApi['testDatasource']> {
    throw new Error('Method not implemented.');
  }
  getRef(): DataSourceRef {
    return { uid: this.uid, type: this.type };
  }
}

const dsStore: Record<string, DataSourceApi> = {
  alertmanager: new MockDatasourceApi('Alertmanager', 3, 'alertmanager', 'alertmanager'),
  loki: new MockDatasourceApi('Loki', 2, 'loki', 'loki'),
  prometheus: new MockDatasourceApi<MockQuery>('Prometheus', 1, 'prometheus', 'prometheus', {
    getQueryDisplayText: (query: MockQuery) => query.queryText || 'Unknown query',
  }),
  mixed: new MixedDatasource({
    id: 4,
    name: 'Mixed',
    type: 'mixed',
    uid: 'mixed',
    meta: { info: { logos: { small: 'mixed.png' } }, mixed: true },
  } as DataSourceInstanceSettings),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getAppEvents: () => mockEventBus,
  getDataSourceSrv: () => ({
    get: (ref: DataSourceRef | string) => {
      const uid = typeof ref === 'string' ? ref : ref.uid;
      if (!uid) {
        return Promise.reject();
      }
      if (dsStore[uid]) {
        return Promise.resolve(dsStore[uid]);
      }
      return Promise.reject();
    },
  }),
}));

const copyStringToClipboard = jest.fn();
jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  copyStringToClipboard: (str: string) => copyStringToClipboard(str),
}));

jest.mock('app/core/app_events', () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
}));

interface MockQuery extends DataQuery {
  query: string;
  queryText?: string;
}

const setup = (propOverrides?: Partial<Props<MockQuery>>, noPanes = false) => {
  const props: Props<MockQuery> = {
    queryHistoryItem: {
      id: '1',
      createdAt: 1,
      datasourceUid: 'loki',
      datasourceName: 'Loki',
      starred: false,
      comment: '',
      queries: [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
        { query: 'query3', refId: 'C' },
      ],
    },
    changeDatasource: jest.fn(),
    starHistoryItem: starRichHistoryMock,
    deleteHistoryItem: deleteRichHistoryMock,
    commentHistoryItem: jest.fn(),
    setQueries: jest.fn(),
    datasourceInstances: [dsStore.loki],
  };

  Object.assign(props, propOverrides);

  const panes = noPanes
    ? {}
    : {
        left: {
          queries: [{ query: 'query1', refId: 'A' }],
          datasourceInstance: dsStore.loki,
          queryResponse: {},
          range: {
            raw: { from: 'now-1h', to: 'now' },
          },
        },
      };

  const store = configureStore({
    explore: {
      panes,
    } as unknown as ExploreState,
  });

  render(
    <TestProvider store={store}>
      <RichHistoryCard {...props} />
    </TestProvider>
  );
};

const starredQueryWithComment: RichHistoryQuery<MockQuery> = {
  id: '1',
  createdAt: 1,
  datasourceUid: 'Test datasource uid',
  datasourceName: 'Test datasource',
  starred: true,
  comment: 'test comment',
  queries: [
    { query: 'query1', refId: 'A' },
    { query: 'query2', refId: 'B' },
    { query: 'query3', refId: 'C' },
  ],
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('RichHistoryCard', () => {
  it('should render all queries', async () => {
    setup();
    const queries = await screen.findAllByLabelText('Query text');
    expect(queries).toHaveLength(3);
    expect(queries[0]).toHaveTextContent('query1');
    expect(queries[1]).toHaveTextContent('query2');
    expect(queries[2]).toHaveTextContent('query3');
  });
  it('should render data source icon and name', async () => {
    setup();
    const datasourceIcon = await screen.findByLabelText('Data source icon');
    const datasourceName = screen.getByLabelText('Data source name');
    expect(datasourceIcon).toBeInTheDocument();
    expect(datasourceName).toBeInTheDocument();
  });

  it('should render "Data source does not exist anymore" if removed data source', async () => {
    setup({
      queryHistoryItem: {
        id: '2',
        createdAt: 1,
        datasourceUid: 'non-existent DS',
        datasourceName: 'Test datasource',
        starred: false,
        comment: '',
        queries: [
          { query: 'query1', refId: 'A' },
          { query: 'query2', refId: 'B' },
          { query: 'query3', refId: 'C' },
        ],
      },
    });
    const datasourceName = await screen.findByLabelText('Data source name');
    expect(datasourceName).toHaveTextContent('Data source does not exist anymore');
  });

  describe('copy queries to clipboard', () => {
    it('should copy query model to clipboard when copying a query from a non existent datasource', async () => {
      setup({
        queryHistoryItem: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'non-existent DS',
          datasourceName: 'Test datasource',
          starred: false,
          comment: '',
          queries: [{ query: 'query1', refId: 'A' }],
        },
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith(JSON.stringify({ query: 'query1' }));
    });

    it('should copy query model to clipboard when copying a query from a datasource that does not implement getQueryDisplayText', async () => {
      setup({
        queryHistoryItem: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'loki',
          datasourceName: 'Test datasource',
          starred: false,
          comment: '',
          queries: [{ query: 'query1', refId: 'A' }],
        },
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith(JSON.stringify({ query: 'query1' }));
    });

    it('should copy query text to clipboard when copying a query from a datasource that implements getQueryDisplayText', async () => {
      setup({
        queryHistoryItem: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'prometheus',
          datasourceName: 'Test datasource',
          starred: false,
          comment: '',
          queries: [
            { query: 'query1', refId: 'A', queryText: 'query1', datasource: { uid: 'prometheus', type: 'prometheus' } },
          ],
        },
        datasourceInstances: [dsStore.prometheus],
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith('query1');
    });

    it('should use each datasource getQueryDisplayText when copying queries', async () => {
      setup({
        queryHistoryItem: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'mixed',
          datasourceName: 'Mixed',
          starred: false,
          comment: '',
          queries: [
            { query: 'query1', refId: 'A', queryText: 'query1', datasource: { uid: 'prometheus' } },
            { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
          ],
        },
        datasourceInstances: [dsStore.loki, dsStore.prometheus, dsStore.mixed],
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith(`query1\n${JSON.stringify({ query: 'query2' })}`);
    });
  });

  describe('commenting', () => {
    it('should render comment, if comment present', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const queryComment = await screen.findByLabelText('Query comment');
      expect(queryComment).toBeInTheDocument();
      expect(queryComment).toHaveTextContent('test comment');
    });
    it('should have title "Edit comment" at comment icon, if comment present', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      const addComment = screen.queryByTitle('Add comment');
      expect(editComment).toBeInTheDocument();
      expect(addComment).not.toBeInTheDocument();
    });
    it('should have title "Add comment" at comment icon, if no comment present', async () => {
      setup();
      const addComment = await screen.findByLabelText('Add comment');
      const editComment = await screen.queryByTitle('Edit comment');
      expect(addComment).toBeInTheDocument();
      expect(editComment).not.toBeInTheDocument();
    });
    it('should open update comment form when edit comment button clicked', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      expect(updateCommentForm).toBeInTheDocument();
    });
    it('should close update comment form when escape key pressed', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      await userEvent.click(updateCommentForm);
      fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
        key: 'Escape',
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).not.toBeInTheDocument();
    });
    it('should close update comment form when enter and shift keys pressed', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      await userEvent.click(updateCommentForm);
      fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
        key: 'Enter',
        shiftKey: true,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).not.toBeInTheDocument();
    });
    it('should close update comment form when enter and ctrl keys pressed', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      await userEvent.click(updateCommentForm);
      fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
        key: 'Enter',
        ctrlKey: true,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).not.toBeInTheDocument();
    });
    it('should not close update comment form when enter key pressed', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const editComment = await screen.findByLabelText('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      await userEvent.click(updateCommentForm);
      fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
        key: 'Enter',
        shiftKey: false,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).toBeInTheDocument();
    });
  });

  describe('starring', () => {
    it('should have title "Star query", if not starred', async () => {
      setup();
      const starButton = await screen.findByLabelText('Star query');
      expect(starButton).toBeInTheDocument();
      await userEvent.click(starButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
    });
    it('should have title "Unstar query", if not starred', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const unstarButton = await screen.findByLabelText('Unstar query');
      expect(unstarButton).toBeInTheDocument();
      await userEvent.click(unstarButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
    });
  });

  describe('deleting', () => {
    it('should delete if not starred', async () => {
      setup();
      const deleteButton = await screen.findByLabelText('Delete query');
      expect(deleteButton).toBeInTheDocument();
      await userEvent.click(deleteButton);
      expect(deleteRichHistoryMock).toBeCalledWith(starredQueryWithComment.id);
    });
    it('should display modal before deleting if starred', async () => {
      setup({ queryHistoryItem: starredQueryWithComment });
      const deleteButton = await screen.findByLabelText('Delete query');
      await userEvent.click(deleteButton);
      expect(deleteRichHistoryMock).not.toBeCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(new ShowConfirmModalEvent(expect.anything()));
    });
  });
});
