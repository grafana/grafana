import { shallow } from 'enzyme';
import React from 'react';

import { DataSourceSettings, NavModel } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { PluginDashboard } from 'app/types';

import { DataSourceDashboards, Props } from './DataSourceDashboards';

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
