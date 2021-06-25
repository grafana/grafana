import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceDashboards, Props } from './DataSourceDashboards';
import { DataSourceSettings, NavModel } from '@grafana/data';
import { PluginDashboard } from 'app/types';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

const setup = (propOverrides?: object) => {
  const props: Props = {
    ...getRouteComponentProps(),
    navModel: {} as NavModel,
    dashboards: [] as PluginDashboard[],
    dataSource: {} as DataSourceSettings,
    dataSourceId: 'x',
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
