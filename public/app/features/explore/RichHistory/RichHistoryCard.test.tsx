import React from 'react';
import { shallow } from 'enzyme';
import { RichHistoryCard, Props } from './RichHistoryCard';
import { ExploreId } from '../../../types/explore';
import { DataSourceApi, DataQuery } from '@grafana/data';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    query: {
      ts: 1,
      datasourceName: 'Test datasource',
      datasourceId: 'datasource 1',
      starred: false,
      comment: '',
      queries: [
        { expr: 'query1', refId: 'A' } as DataQuery,
        { expr: 'query2', refId: 'B' } as DataQuery,
        { expr: 'query3', refId: 'C' } as DataQuery,
      ],
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

  const wrapper = shallow(<RichHistoryCard {...props} />);
  return wrapper;
};

const starredQueryWithComment = {
  ts: 1,
  datasourceName: 'Test datasource',
  datasourceId: 'datasource 1',
  starred: true,
  comment: 'test comment',
  queries: [
    { query: 'query1', refId: 'A' },
    { query: 'query2', refId: 'B' },
    { query: 'query3', refId: 'C' },
  ],
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
    ).toEqual('{"expr":"query1"}');
    expect(
      wrapper
        .find({ 'aria-label': 'Query text' })
        .at(1)
        .text()
    ).toEqual('{"expr":"query2"}');
    expect(
      wrapper
        .find({ 'aria-label': 'Query text' })
        .at(2)
        .text()
    ).toEqual('{"expr":"query3"}');
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
    it('should have title "Unstar query", if not starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.find({ title: 'Unstar query' })).toHaveLength(1);
    });
  });
});
