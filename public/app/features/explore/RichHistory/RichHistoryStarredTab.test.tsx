import { mount } from 'enzyme';
import React from 'react';

import { SortOrder } from 'app/core/utils/richHistory';

import { ExploreId } from '../../../types/explore';

import { RichHistoryStarredTab, Props } from './RichHistoryStarredTab';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getList: () => [],
    };
  },
}));

const setup = (activeDatasourceOnly = false) => {
  const props: Props = {
    queries: [],
    loading: false,
    totalQueries: 0,
    activeDatasourceInstance: {} as any,
    updateFilters: jest.fn(),
    loadMoreRichHistory: jest.fn(),
    clearRichHistoryResults: jest.fn(),
    exploreId: ExploreId.left,
    richHistorySettings: {
      retentionPeriod: 7,
      starredTabAsFirstTab: false,
      activeDatasourceOnly,
      lastUsedDatasourceFilters: [],
    },
    richHistorySearchFilters: {
      search: '',
      sortOrder: SortOrder.Ascending,
      datasourceFilters: [],
      from: 0,
      to: 7,
      starred: false,
    },
  };

  const wrapper = mount(<RichHistoryStarredTab {...props} />);
  return wrapper;
};

describe('RichHistoryStarredTab', () => {
  describe('sorter', () => {
    it('should render sorter', () => {
      const wrapper = setup();
      expect(wrapper.find({ 'aria-label': 'Sort queries' })).toHaveLength(1);
    });
  });

  describe('select datasource', () => {
    it('should render select datasource if activeDatasourceOnly is false', () => {
      const wrapper = setup();
      expect(wrapper.find({ 'aria-label': 'Filter queries for data sources(s)' }).exists()).toBeTruthy();
    });

    it('should not render select datasource if activeDatasourceOnly is true', () => {
      const wrapper = setup(true);
      expect(wrapper.find({ 'aria-label': 'Filter queries for data sources(s)' }).exists()).toBeFalsy();
    });
  });
});
