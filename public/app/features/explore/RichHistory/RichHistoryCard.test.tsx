import React from 'react';
import { mount } from 'enzyme';
import { RichHistoryCard, Props } from './RichHistoryCard';
import { ExploreId } from '../../../types/explore';
import { DataSourceApi } from '@grafana/data';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    query: {
      ts: 1,
      datasourceName: 'Test datasource',
      datasourceId: 'datasource 1',
      starred: false,
      comment: '',
      queries: ['query1', 'query2', 'query3'],
      sessionName: '',
    },
    dsImg: '/app/img',
    isRemoved: false,
    changeDatasource: jest.fn(),
    updateRichHistory: jest.fn(),
    setQueries: jest.fn(),
    exploreId: ExploreId.left,
    datasourceInstance: { name: 'Datasource' } as DataSourceApi,
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistoryCard {...props} />);
  return wrapper;
};

const starredQueryWithComment = {
  ts: 1,
  datasourceName: 'Test datasource',
  datasourceId: 'datasource 1',
  starred: true,
  comment: 'test comment',
  queries: ['query1', 'query2', 'query3'],
  sessionName: '',
};

describe('RichHistoryCard', () => {
  it('should render all queries', () => {
    const wrapper = setup();
    expect(wrapper.find({ 'aria-label': 'Query text' })).toHaveLength(3);
    expect(
      wrapper
        .find({ 'aria-label': 'Query text' })
        .at(0)
        .text()
    ).toEqual('query1');
    expect(
      wrapper
        .find({ 'aria-label': 'Query text' })
        .at(1)
        .text()
    ).toEqual('query2');
    expect(
      wrapper
        .find({ 'aria-label': 'Query text' })
        .at(2)
        .text()
    ).toEqual('query3');
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
  });

  describe('starring', () => {
    it('should have title "Star query", if not starred', () => {
      const wrapper = setup();
      expect(wrapper.find({ title: 'Star query' })).toHaveLength(1);
    });
    it('should render fa-star-o icon, if not starred', () => {
      const wrapper = setup();
      expect(wrapper.find({ title: 'Star query' }).hasClass('fa-star-o')).toBe(true);
    });
    it('should have title "Unstar query", if not starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.find({ title: 'Unstar query' })).toHaveLength(1);
    });
    it('should have fa-star icon, if not starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.find({ title: 'Unstar query' }).hasClass('fa-star')).toBe(true);
    });
  });
});
