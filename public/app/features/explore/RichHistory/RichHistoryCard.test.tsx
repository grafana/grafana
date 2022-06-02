import { render, screen, fireEvent, getByText } from '@testing-library/react';
import React from 'react';

import { DataSourceApi, DataQuery } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { ShowConfirmModalEvent } from 'app/types/events';
import { ExploreId, RichHistoryQuery } from 'app/types/explore';

import { RichHistoryCard, Props } from './RichHistoryCard';

const starRichHistoryMock = jest.fn();
const deleteRichHistoryMock = jest.fn();

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve(mockDS),
      getList: () => [mockDS],
      getInstanceSettings: () => mockDS,
    }),
  };
});

jest.mock('app/core/app_events', () => ({
  publish: jest.fn(),
}));

interface MockQuery extends DataQuery {
  query: string;
}

const setup = (propOverrides?: Partial<Props<MockQuery>>) => {
  const props: Props<MockQuery> = {
    query: {
      id: '1',
      createdAt: 1,
      datasourceUid: 'Test datasource uid',
      datasourceName: 'Test datasource',
      starred: false,
      comment: '',
      queries: [
        { query: 'query1', refId: 'A' },
        { query: 'query2', refId: 'B' },
        { query: 'query3', refId: 'C' },
      ],
    },
    dsImg: '/app/img',
    isRemoved: false,
    changeDatasource: jest.fn(),
    starHistoryItem: starRichHistoryMock,
    deleteHistoryItem: deleteRichHistoryMock,
    commentHistoryItem: jest.fn(),
    setQueries: jest.fn(),
    exploreId: ExploreId.left,
    datasourceInstance: { name: 'Datasource' } as DataSourceApi,
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
    setup({ isRemoved: true });
    const datasourceName = await screen.findByLabelText('Data source name');
    expect(datasourceName).toHaveTextContent('Data source does not exist anymore');
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
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      expect(updateCommentForm).toBeInTheDocument();
    });
    it('should close update comment form when escape key pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      fireEvent.keyDown(getByText(updateCommentForm, starredQueryWithComment.comment), {
        key: 'Escape',
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).not.toBeInTheDocument();
    });
    it('should close update comment form when enter and shift keys pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
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
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
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
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
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
      fireEvent.click(starButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
    });
    it('should have title "Unstar query", if not starred', async () => {
      setup({ query: starredQueryWithComment });
      const unstarButton = await screen.findByTitle('Unstar query');
      expect(unstarButton).toBeInTheDocument();
      fireEvent.click(unstarButton);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
    });
  });

  describe('deleting', () => {
    it('should delete if not starred', async () => {
      setup();
      const deleteButton = await screen.findByTitle('Delete query');
      expect(deleteButton).toBeInTheDocument();
      fireEvent.click(deleteButton);
      expect(deleteRichHistoryMock).toBeCalledWith(starredQueryWithComment.id);
    });
    it('should display modal before deleting if starred', async () => {
      setup({ query: starredQueryWithComment });
      const deleteButton = await screen.findByTitle('Delete query');
      fireEvent.click(deleteButton);
      expect(deleteRichHistoryMock).not.toBeCalled();
      expect(appEvents.publish).toHaveBeenCalledWith(new ShowConfirmModalEvent(expect.anything()));
    });
  });
});
