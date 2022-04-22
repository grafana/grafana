import { shallow } from 'enzyme';
import React from 'react';

import { DataSourceApi, DataQuery } from '@grafana/data';

import { ExploreId, RichHistoryQuery } from '../../../types/explore';

import { RichHistoryCard, Props } from './RichHistoryCard';

const starRichHistoryMock = jest.fn();

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

  const wrapper = shallow(<RichHistoryCard {...props} />);
  return wrapper;
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
  it('should render all queries', () => {
    const wrapper = setup();
    expect(wrapper.find({ 'aria-label': 'Query text' })).toHaveLength(3);
    expect(wrapper.find({ 'aria-label': 'Query text' }).at(0).text()).toEqual('{"query":"query1"}');
    expect(wrapper.find({ 'aria-label': 'Query text' }).at(1).text()).toEqual('{"query":"query2"}');
    expect(wrapper.find({ 'aria-label': 'Query text' }).at(2).text()).toEqual('{"query":"query3"}');
  });
  it('should render data source icon', () => {
    const wrapper = setup();
    expect(wrapper.find({ 'aria-label': 'Data source icon' })).toHaveLength(1);
  });
  it('should render data source name', () => {
    const wrapper = setup();
    expect(wrapper.find({ 'aria-label': 'Data source name' }).text()).toEqual('Test datasource');
  });
  it('should render "Data source does not exist anymore" if removed data source', () => {
    const wrapper = setup({ isRemoved: true });
    expect(wrapper.find({ 'aria-label': 'Data source name' }).text()).toEqual('Data source does not exist anymore');
  });

  describe('commenting', () => {
    it('should render comment, if comment present', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.find({ 'aria-label': 'Query comment' })).toHaveLength(1);
      expect(wrapper.find({ 'aria-label': 'Query comment' }).text()).toEqual('test comment');
    });
    it('should have title "Edit comment" at comment icon, if comment present', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.find({ title: 'Edit comment' })).toHaveLength(1);
      expect(wrapper.find({ title: 'Add comment' })).toHaveLength(0);
    });
    it('should have title "Add comment" at comment icon, if no comment present', () => {
      const wrapper = setup();
      expect(wrapper.find({ title: 'Add comment' })).toHaveLength(1);
      expect(wrapper.find({ title: 'Edit comment' })).toHaveLength(0);
    });
    it('should open update comment form when edit comment button clicked', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const editCommentButton = wrapper.find({ title: 'Edit comment' });
      editCommentButton.simulate('click');
      expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(1);
    });
    it('should close update comment form when escape key pressed', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const editCommentButton = wrapper.find({ title: 'Edit comment' });
      editCommentButton.simulate('click');
      wrapper.simulate('keydown', { key: 'Escape' });
      expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
    });
    it('should close update comment form when enter and shift keys pressed', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const editCommentButton = wrapper.find({ title: 'Edit comment' });
      editCommentButton.simulate('click');
      wrapper.simulate('keydown', { key: 'Enter', shiftKey: true });
      expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
    });
    it('should close update comment form when enter and ctrl keys pressed', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const editCommentButton = wrapper.find({ title: 'Edit comment' });
      editCommentButton.simulate('click');
      wrapper.simulate('keydown', { key: 'Enter', ctrlKey: true });
      expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(0);
    });
    it('should not close update comment form when enter key pressed', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const editCommentButton = wrapper.find({ title: 'Edit comment' });
      editCommentButton.simulate('click');
      wrapper.simulate('keydown', { key: 'Enter', shiftKey: false });
      expect(wrapper.find({ 'aria-label': 'Update comment form' })).toHaveLength(1);
    });
  });

  describe('starring', () => {
    it('should have title "Star query", if not starred', () => {
      const wrapper = setup();
      const starButton = wrapper.find({ title: 'Star query' });
      expect(starButton).toHaveLength(1);
      starButton.simulate('click');
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, true);
    });
    it('should have title "Unstar query", if not starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      const starButton = wrapper.find({ title: 'Unstar query' });
      expect(starButton).toHaveLength(1);
      starButton.simulate('click');
      expect(starRichHistoryMock).toBeCalledWith(starredQueryWithComment.id, false);
    });
  });
});
