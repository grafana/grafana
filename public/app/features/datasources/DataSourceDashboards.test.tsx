import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceSettings } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { RouteDescriptor } from 'app/core/navigation/types';
import { PluginDashboard } from 'app/types';

import { DataSourceDashboards, Props } from './DataSourceDashboards';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    ...getRouteComponentProps(),
    navModel: { main: { text: 'nav-text' }, node: { text: 'node-text' } },
    dashboards: [] as PluginDashboard[],
    dataSource: {} as DataSourceSettings,
    dataSourceId: 'x',
    importDashboard: jest.fn(),
    loadDataSource: jest.fn(),
    loadPluginDashboards: jest.fn(),
    removeDashboard: jest.fn(),
    route: {} as RouteDescriptor,
    isLoading: false,
    ...propOverrides,
  };

  return render(<DataSourceDashboards {...props} />);
};

describe('Render', () => {
  it('should render without exploding', () => {
    expect(() => setup()).not.toThrow();
  });
  it('should render component', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'nav-text' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
  });
});
