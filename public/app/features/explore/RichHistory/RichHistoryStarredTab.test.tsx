import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { SortOrder } from 'app/core/utils/richHistory';
import { RichHistoryStarredTab, Props } from './RichHistoryStarredTab';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    queries: [],
    sortOrder: SortOrder.Ascending,
    activeDatasourceOnly: false,
    datasourceFilters: null,
    exploreId: ExploreId.left,
    onChangeSortOrder: jest.fn(),
    onSelectDatasourceFilters: jest.fn(),
  };

  Object.assign(props, propOverrides);

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
      expect(wrapper.find({ 'aria-label': 'Filter datasources' })).toHaveLength(1);
    });

    it('should not render select datasource if activeDatasourceOnly is true', () => {
      const wrapper = setup({ activeDatasourceOnly: true });
      expect(wrapper.find({ 'aria-label': 'Filter datasources' })).toHaveLength(0);
    });
  });
});
