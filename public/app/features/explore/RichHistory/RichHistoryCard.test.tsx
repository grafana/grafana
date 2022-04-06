import React from 'react';
import { render, screen, fireEvent, getByText, waitForElementToBeRemoved } from '@testing-library/react';
import { RichHistoryCard, Props } from './RichHistoryCard';
import { ExploreId, RichHistoryQuery } from '../../../types/explore';
import { DataSourceApi, DataQuery } from '@grafana/data';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

const starRichHistoryMock = jest.fn();

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      get: () => Promise.resolve(mockDS),
      getList: () => [mockDS],
      getInstanceSettings: () => mockDS,
    }),
  };
});

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
    commentHistoryItem: jest.fn(),
    deleteHistoryItem: jest.fn(),
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
    const datasourceIcon = await screen.findAllByLabelText('Data source icon');
    const datasourceName = await screen.findAllByLabelText('Data source name');
    expect(datasourceIcon).toHaveLength(1);
    expect(datasourceName).toHaveLength(1);
  });
  it('should render "Data source does not exist anymore" if removed data source', async () => {
    setup({ isRemoved: true });
    const datasourceName = await screen.findByLabelText('Data source name');
    expect(datasourceName).toHaveTextContent('Data source does not exist anymore');
  });

  describe('commenting', () => {
    it('should render comment, if comment present', async () => {
      setup({ query: starredQueryWithComment });
      const queryComment = await screen.findAllByLabelText('Query comment');
      expect(queryComment).toHaveLength(1);
      expect(queryComment[0]).toHaveTextContent('test comment');
    });
    it('should have title "Edit comment" at comment icon, if comment present', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      const addComment = await screen.queryByTitle('Add comment');
      expect(editComment).toBeVisible();
      expect(addComment).toBeNull();
    });
    it('should have title "Add comment" at comment icon, if no comment present', async () => {
      setup();
      const addComment = await screen.findByTitle('Add comment');
      const editComment = await screen.queryByTitle('Edit comment');
      expect(addComment).toBeVisible();
      expect(editComment).toBeNull();
    });
    it('should open update comment form when edit comment button clicked', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      expect(updateCommentForm).toBeVisible();
    });
    it('should close update comment form when escape key pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      fireEvent.keyDown(getByText(updateCommentForm || new HTMLElement(), starredQueryWithComment.comment), {
        key: 'Escape',
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).toBeNull();
    });
    it('should close update comment form when enter and shift keys pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      fireEvent.keyDown(getByText(updateCommentForm || new HTMLElement(), starredQueryWithComment.comment), {
        key: 'Enter',
        shiftKey: true,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).toBeNull();
    });
    it('should close update comment form when enter and ctrl keys pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      fireEvent.keyDown(getByText(updateCommentForm || new HTMLElement(), starredQueryWithComment.comment), {
        key: 'Enter',
        ctrlKey: true,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).toBeNull();
    });
    it('should not close update comment form when enter key pressed', async () => {
      setup({ query: starredQueryWithComment });
      const editComment = await screen.findByTitle('Edit comment');
      fireEvent.click(editComment);
      const updateCommentForm = await screen.findByLabelText('Update comment form');
      fireEvent.keyDown(getByText(updateCommentForm || new HTMLElement(), starredQueryWithComment.comment), {
        key: 'Enter',
        shiftKey: false,
      });
      const findCommentForm = screen.queryByLabelText('Update comment form');
      expect(findCommentForm).toBeVisible();
    });
  });

  describe('starring', () => {
    it('should have title "Star query", if not starred', async () => {
      setup();
      const starButton = await screen.findAllByTitle('Star query');
      expect(starButton).toHaveLength(1);
      fireEvent.click(starButton[0]);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
    });
    it('should have title "Unstar query", if not starred', async () => {
      setup({ query: starredQueryWithComment });
      const unstarButton = await screen.findAllByTitle('Unstar query');
      expect(unstarButton).toHaveLength(1);
      fireEvent.click(unstarButton[0]);
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
    });
  });
});
