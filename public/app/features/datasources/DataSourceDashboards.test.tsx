import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceDashboards, Props } from './DataSourceDashboards';
import { DataSourceSettings } from '@grafana/data';
import { NavModel } from '@grafana/data';
import { PluginDashboard } from 'app/types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    dashboards: [] as PluginDashboard[],
    dataSource: {} as DataSourceSettings,
    pageId: 1,
    importDashboard: jest.fn(),
    loadDataSource: jest.fn(),
    loadPluginDashboards: jest.fn(),
    removeDashboard: jest.fn(),
    isLoading: false,
  };

  Object.assign(props, propOverrides);

  return shallow(<DataSourceDashboards {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
