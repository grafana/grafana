import React from 'react';
import { mount } from 'enzyme';
import { ExploreId } from '../../../types/explore';
import { SortOrder } from 'app/core/utils/richHistory';
import { RichHistoryQueriesTab, Props } from './RichHistoryQueriesTab';
import { Slider } from '@grafana/ui';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    queries: [],
    sortOrder: SortOrder.Ascending,
    activeDatasourceOnly: false,
    datasourceFilters: null,
    retentionPeriod: 14,
    height: 100,
    exploreId: ExploreId.left,
    onChangeSortOrder: jest.fn(),
    onSelectDatasourceFilters: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistoryQueriesTab {...props} />);
  return wrapper;
};

describe('RichHistoryQueriesTab', () => {
  describe('slider', () => {
    it('should render slider', () => {
      const wrapper = setup();
      expect(wrapper.find(Slider)).toHaveLength(1);
    });
    it('should render slider with correct timerange', () => {
      const wrapper = setup();
      expect(
        wrapper
          .find('.label-slider')
          .at(1)
          .text()
      ).toEqual('today');
      expect(
        wrapper
          .find('.label-slider')
          .at(2)
          .text()
      ).toEqual('two weeks ago');
    });
  });

  describe('sort options', () => {
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
