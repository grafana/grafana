import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceSettings, NavModel } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { PluginDashboard } from 'app/types';

import { DataSourceDashboards, Props } from './DataSourceDashboards';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    ...getRouteComponentProps(),
    navModel: { main: 'test', node: { text: 'test' } },
    dashboards: [] as PluginDashboard[],
    dataSource: {} as DataSourceSettings,
    dataSourceId: 'x',
    importDashboard: jest.fn(),
    loadDataSource: jest.fn(),
    loadPluginDashboards: jest.fn(),
    removeDashboard: jest.fn(),
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

    expect(screen.getByRole('table')).toHaveClass('filter-table');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Community' })).toBeInTheDocument();
  });
});
