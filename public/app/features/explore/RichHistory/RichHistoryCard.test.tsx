import { fireEvent, render, screen, getByText, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceApi, DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { MixedDatasource } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExploreId, RichHistoryQuery } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { RichHistoryCard, Props } from './RichHistoryCard';

const starRichHistoryMock = jest.fn();
const deleteRichHistoryMock = jest.fn();

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
    throw new Error('Method not implemented.');
  }
}

const dsStore: Record<string, DataSourceApi> = {
  alertmanager: new MockDatasourceApi('Alertmanager', 3, 'alertmanager', 'alertmanager'),
  loki: new MockDatasourceApi('Loki', 2, 'loki', 'loki'),
  prometheus: new MockDatasourceApi<MockQuery>('Prometheus', 1, 'prometheus', 'prometheus', {
    getQueryDisplayText: (query: MockQuery) => query.queryText || 'Unknwon query',
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
}));

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
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
  };
});

const copyStringToClipboard = jest.fn();
jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  copyStringToClipboard: (str: string) => copyStringToClipboard(str),
}));

jest.mock('app/core/app_events', () => ({
  publish: jest.fn(),
}));

interface MockQuery extends DataQuery {
  query: string;
  queryText?: string;
}

const setup = (propOverrides?: Partial<Props<MockQuery>>) => {
  const props: Props<MockQuery> = {
    query: {
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
    exploreId: ExploreId.left,
    datasourceInstance: dsStore.loki,
  };

  Object.assign(props, propOverrides);

  render(<RichHistoryCard {...props} />);
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
      query: {
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
        query: {
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
        query: {
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
        query: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'prometheus',
          datasourceName: 'Test datasource',
          starred: false,
          comment: '',
          queries: [{ query: 'query1', refId: 'A', queryText: 'query1' }],
        },
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith('query1');
    });

    it('should use each datasource getQueryDisplayText when copying queries', async () => {
      setup({
        query: {
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
      });
      const copyQueriesButton = await screen.findByRole('button', { name: 'Copy query to clipboard' });
      expect(copyQueriesButton).toBeInTheDocument();
      await userEvent.click(copyQueriesButton);
      expect(copyStringToClipboard).toHaveBeenCalledTimes(1);
      expect(copyStringToClipboard).toHaveBeenCalledWith(`query1\n${JSON.stringify({ query: 'query2' })}`);
    });
  });

  describe('run queries', () => {
    it('should be disabled if at least one query datasource is missing when using mixed', async () => {
      const setQueries = jest.fn();
      const changeDatasource = jest.fn();
      const queries: MockQuery[] = [
        { query: 'query1', refId: 'A', datasource: { uid: 'nonexistent-ds' } },
        { query: 'query2', refId: 'B', datasource: { uid: 'loki' } },
      ];
      setup({
        setQueries,
        changeDatasource,
        query: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'mixed',
          datasourceName: 'Mixed',
          starred: false,
          comment: '',
          queries,
        },
      });
      const runQueryButton = await screen.findByRole('button', { name: /run query/i });

      expect(runQueryButton).toBeDisabled();
    });

    it('should be disabled if at datasource is missing', async () => {
      const setQueries = jest.fn();
      const changeDatasource = jest.fn();
      const queries: MockQuery[] = [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
      ];
      setup({
        setQueries,
        changeDatasource,
        query: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'nonexistent-ds',
          datasourceName: 'nonexistent-ds',
          starred: false,
          comment: '',
          queries,
        },
      });
      const runQueryButton = await screen.findByRole('button', { name: /run query/i });

      expect(runQueryButton).toBeDisabled();
    });

    it('should only set new queries when running queries from the same datasource', async () => {
      const setQueries = jest.fn();
      const changeDatasource = jest.fn();
      const queries: MockQuery[] = [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
      ];
      setup({
        setQueries,
        changeDatasource,
        query: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'loki',
          datasourceName: 'Loki',
          starred: false,
          comment: '',
          queries,
        },
      });

      const runQueryButton = await screen.findByRole('button', { name: /run query/i });
      await userEvent.click(runQueryButton);

      expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
      expect(changeDatasource).not.toHaveBeenCalled();
    });

    it('should change datasource to mixed and set new queries when running queries from mixed datasource', async () => {
      const setQueries = jest.fn();
      const changeDatasource = jest.fn();
      const queries: MockQuery[] = [
        { query: 'query1', refId: 'A', datasource: { type: 'loki', uid: 'loki' } },
        { query: 'query2', refId: 'B', datasource: { type: 'prometheus', uid: 'prometheus' } },
      ];
      setup({
        setQueries,
        changeDatasource,
        query: {
          id: '2',
          createdAt: 1,
          datasourceUid: 'mixed',
          datasourceName: 'Mixed',
          starred: false,
          comment: '',
          queries,
        },
      });

      const runQueryButton = await screen.findByRole('button', { name: /run query/i });
      await userEvent.click(runQueryButton);

      await waitFor(() => {
        expect(setQueries).toHaveBeenCalledWith(expect.any(String), queries);
        expect(changeDatasource).toHaveBeenCalledWith(expect.any(String), 'mixed');
      });
    });
  });

  describe('commenting', () => {
    it('should render comment, if comment present', async () => {
      setup({ query: starredQueryWithComment });
      const queryComment = await screen.findByLabelText('Query comment');
      expect(queryComment).toBeInTheDocument();
      expect(queryComment).toHaveTextContent('test comment');
    });
    it('should have title "Edit comment" at comment icon, if comment present', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      const addComment = screen.queryByTitle('Add comment');
      expect(editComment).toBeInTheDocument();
      expect(addComment).not.toBeInTheDocument();
    });
    it('should have title "Add comment" at comment icon, if no comment present', async () => {
      setup();
      const addComment = await screen.findByTitle('Add comment');
      const editComment = await screen.queryByTitle('Edit comment');
      expect(addComment).toBeInTheDocument();
      expect(editComment).not.toBeInTheDocument();
    });
    it('should open update comment form when edit comment button clicked', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      await userEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      expect(updateCommentForm).toBeInTheDocument();
    });
    it('should close update comment form when escape key pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
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
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
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
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
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
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
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
      const starButton = await screen.findByTitle('Star query');
      expect(starButton).toBeInTheDocument();
      await userEvent.click(starButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
    });
    it('should have title "Unstar query", if not starred', async () => {
      setup({ query: starredQueryWithComment });
      const unstarButton = await screen.findByTitle('Unstar query');
      expect(unstarButton).toBeInTheDocument();
      await userEvent.click(unstarButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
    });
  });

  describe('deleting', () => {
    it('should delete if not starred', async () => {
      setup();
      const deleteButton = await screen.findByTitle('Delete query');
      expect(deleteButton).toBeInTheDocument();
      await userEvent.click(deleteButton);
      expect(deleteRichHistoryMock).toBeCalledWith(starredQueryWithComment.id);
    });
    it('should display modal before deleting if starred', async () => {
      setup({ query: starredQueryWithComment });
      const deleteButton = await screen.findByTitle('Delete query');
      await userEvent.click(deleteButton);
      expect(deleteRichHistoryMock).not.toBeCalled();
      expect(appEvents.publish).toHaveBeenCalledWith(new ShowConfirmModalEvent(expect.anything()));
    });
  });
});
