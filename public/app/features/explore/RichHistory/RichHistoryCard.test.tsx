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
    changeQuery: jest.fn(),
    changeDatasource: jest.fn(),
    clearQueries: jest.fn(),
    updateRichHistory: jest.fn(),
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
    expect(wrapper.html()).toContain('query1');
    expect(wrapper.html()).toContain('query2');
    expect(wrapper.html()).toContain('query3');
  });

  describe('commenting', () => {
    it('should render comment, if comment present', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.html()).toContain('test comment');
    });
    it('should have title "Edit comment" at comment icon, if comment present', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.html()).toContain('Edit comment');
    });
    it('should have title "Add comment" at comment icon, if no comment present', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('Add comment');
    });
  });

  describe('starring', () => {
    it('should render fa-star-o icon, if not starred', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('fa-star-o');
    });
    it('should have title "Star query", if not starred', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('Star query');
    });

    it('should have fa-star icon, if starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.html()).toContain('fa-star');
    });

    it('should have title "Unstar query", if starred', () => {
      const wrapper = setup({ query: starredQueryWithComment });
      expect(wrapper.html()).toContain('Unstar query');
    });
  });
});
