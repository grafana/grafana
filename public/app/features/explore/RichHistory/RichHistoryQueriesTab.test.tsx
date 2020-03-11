import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { SortOrder } from 'app/core/utils/explore';
import { RichHistoryQueriesTab, Props } from './RichHistoryQueriesTab';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    queries: [],
    sortOrder: SortOrder.Ascending,
    activeDatasourceOnly: false,
    datasourceFilters: null,
    retentionPeriod: 14,
    exploreId: ExploreId.left,
    onChangeSortOrder: jest.fn(),
    onSelectDatasourceFilters: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistoryQueriesTab {...props} />);
  return wrapper;
};

describe('RichHistoryQueriesTab', () => {
  it('should render without errors', () => {
    setup();
  });

  describe('slider', () => {
    it('should render slider', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('aria-label="slider');
    });
    it('should render slider with correct timerange', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('today');
      expect(wrapper.html()).toContain('two weeks ago');
    });
  });

  describe('sort options', () => {
    it('should render sorter', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('aria-label="sort queries"');
    });
  });

  describe('select datasource', () => {
    it('should render select datasource if activeDatasourceOnly is false', () => {
      const wrapper = setup();
      expect(wrapper.html()).toContain('aria-label="filter datasources"');
    });

    it('should not render select datasource if activeDatasourceOnly is true', () => {
      const wrapper = setup({ activeDatasourceOnly: true });
      expect(wrapper.html()).not.toContain('aria-label="filter datasources"');
    });
  });
});
