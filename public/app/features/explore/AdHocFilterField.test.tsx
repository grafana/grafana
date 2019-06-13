import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceApi } from '@grafana/ui';

import { AdHocFilterField, DEFAULT_REMOVE_FILTER_VALUE } from './AdHocFilterField';
import { AdHocFilter } from './AdHocFilter';
import { DataSourceApi } from '@grafana/ui';
import { MockDataSourceApi } from '../../../test/mocks/datasource_srv';

describe('<AdHocFilterField />', () => {
  let mockDataSourceApi: DataSourceApi;

  beforeEach(() => {
    mockDataSourceApi = new MockDataSourceApi();
  });

  it('should initially have no filters', () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);
    expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();
  });

  it('should add <AdHocFilter /> when onAddFilter is invoked', () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);
    wrapper
      .find('button')
      .first()
      .simulate('click');
    expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();
  });

  it(`should remove the relavant filter when the '${DEFAULT_REMOVE_FILTER_VALUE}' key is selected`, () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);

    wrapper
      .find('button')
      .first()
      .simulate('click');
    expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();

    wrapper.find(AdHocFilter).prop('onKeyChanged')(DEFAULT_REMOVE_FILTER_VALUE);
    expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();
  });

  it('it should call onPairsChanged when a filter is removed', async () => {
    const mockOnPairsChanged = jest.fn();
    const wrapper = shallow(<AdHocFilterField datasource={mockDataSourceApi} onPairsChanged={mockOnPairsChanged} />);
    expect(wrapper.state('pairs')).toEqual([]);

    wrapper
      .find('button')
      .first()
      .simulate('click');
    expect(wrapper.find(AdHocFilter).exists()).toBeTruthy();

    wrapper.find(AdHocFilter).prop('onKeyChanged')(DEFAULT_REMOVE_FILTER_VALUE);
    expect(wrapper.find(AdHocFilter).exists()).toBeFalsy();

    expect(mockOnPairsChanged.mock.calls.length).toBe(1);
  });
});
